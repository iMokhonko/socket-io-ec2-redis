const { DynamoDBClient, TransactWriteItemsCommand } = require("@aws-sdk/client-dynamodb");
const dbClient = new DynamoDBClient({ region: 'eu-central-1' });
const generatePartitionPostfix = require('../helpers/generate-partition-postfix');
const ksuid = require('ksuid');

const TABLE_NAME = "test-table";

module.exports = async ({ conversationId, text, owner = 'ivan.mokhonko' } = {}, callback) => {
  const messageId = (await ksuid.random()).string;
  const messageTime = Date.now();

  const params = {
    TransactItems: [
      // update conversation info
      {
        Update: {
          TableName: TABLE_NAME,
            Key: {
              PK: { S: `CONVERSATION#${conversationId}` },
              SK: { S: `CONVERSATION#${conversationId}` }
            },
            ExpressionAttributeValues: {
              ':inc': { N: '1' },
              ':messageText': { S: text },
              ':messageTime': { S: `${messageTime}` },
              ':messageId': { S: messageId }
            },
            UpdateExpression: 'SET lastMessageData.messageText = :messageText, lastMessageData.messageTime = :messageTime, lastMessageData.id = :messageId ADD messagesCount :inc',
            ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)"
        }
      },

      // create/update conversation messages by day metadata
      {
        Update: {
          TableName: TABLE_NAME,
          Key: {
            PK: { S: `CONVERSATION#${conversationId}#${generatePartitionPostfix()}` },
            SK: { S: 'METADATA' }
          },
          ExpressionAttributeValues: {
            ':inc': { N: '1' },
          },
          UpdateExpression: 'ADD messagesCount :inc',
        }
      },

      // insert message
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            PK: { S: `CONVERSATION#${conversationId}#${generatePartitionPostfix()}` },
            SK: { S: `MESSAGE#${messageId}` },
            owner: { S: owner },
            text: { S: text },
            time: { N: `${messageTime}` },
            viewsCount: { N: '1' }
          },
          ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
        },
      }
    ]
  };
  
  const command = new TransactWriteItemsCommand(params);

  try {
    await dbClient.send(command);

    callback({ status: 'ok' });
  } catch (err) {
    console.error(err);
  }
}