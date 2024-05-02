const { DynamoDBClient, TransactWriteItemsCommand } = require("@aws-sdk/client-dynamodb");
const dbClient = new DynamoDBClient({ region: 'eu-central-1' });
const ksuid = require('ksuid');
const generatePartitionPostfix = require('../helpers/generate-partition-postfix');

const TABLE_NAME = "test-table";

module.exports = async ({ to = 'serhii.mokhonko', from = 'ivan.mokhonko', text = '' } = {}, callback) => {
  // always generate the same conversationId for those users
	const conversationId = [to, from].sort().join(':');
  const messageId = (await ksuid.random()).string;


  const messageTime = Date.now();

	const params = {
    TransactItems: [
      // сreate/update conversation object
      {
        Update: {
          TableName: TABLE_NAME,

          Key: {
            PK: { S: `CONVERSATION#${conversationId}` },
            SK: { S: `CONVERSATION#${conversationId}` },
          },

          ExpressionAttributeNames: {
            '#conversationType': 'conversationType',
            '#messagesCount': 'messagesCount'
          },

          ExpressionAttributeValues: {
            ':type': { S: 'USER' },
            ':inc': { N: '1' },
          },

          UpdateExpression: 'SET #conversationType = :type ADD #messagesCount :inc',
        },
      },

      // add/update this conversation to user that sent message
			{
				Update: {
					TableName: TABLE_NAME,

          Key: {
            PK: { S: `USER_CHATS#${from}` },
            SK: { S: `USER#${to}` }
          },

          ExpressionAttributeNames: {
            '#conversationId': 'conversationId',
            '#conversationType': 'conversationType'
          },

          ExpressionAttributeValues: {
            ':conversationId': { S: conversationId },
            ':type': { S: 'USER' },
          },
          
          UpdateExpression: 'SET #conversationType = :type, #conversationId = :conversationId',
				}
			},

      // add/update this conversation to user that should recieve this message
      {
				Update: {
					TableName: TABLE_NAME,

          Key: {
            PK: { S: `USER_CHATS#${to}` },
            SK: { S: `USER#${from}` }
          },

          ExpressionAttributeNames: {
            '#conversationId': 'conversationId',
            '#conversationType': 'conversationType'
          },

          ExpressionAttributeValues: {
            ':conversationId': { S: conversationId },
            ':type': { S: 'USER' },
          },
          
          UpdateExpression: 'SET #conversationType = :type, #conversationId = :conversationId',
				}
			},

      // add message that user sent to this conversation
      {
				Put: {
					TableName: TABLE_NAME,
			
					Item: {
						PK: { S: `CONVERSATION#${conversationId}#${generatePartitionPostfix()}` },
						SK: { S: `MESSAGE#${messageId}` },
						owner: { S: from },
            text: { S: text },
            time: { N: `${messageTime}` },
					},
					
					ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
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
		]
	}

	const command = new TransactWriteItemsCommand(params);

	try {
		await dbClient.send(command);

		callback({ status: 'ok', conversationId, messageId });
	} catch (err) {
		console.error(err);
	}
}