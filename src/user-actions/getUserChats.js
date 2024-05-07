const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const dbClient = new DynamoDBClient({ region: 'eu-central-1' });
const TABLE_NAME = "test-table";

const getConversationIdFromTwoUsers = require('../helpers/get-conversation-id-from-two-users');

module.exports = async (userId) => {
  const params = {
    TableName: TABLE_NAME,

    ExpressionAttributeNames: { '#pk': 'PK' },
    ExpressionAttributeValues: { ':pk': { S: `USER_CHATS#${userId}` } },
    KeyConditionExpression: '#pk = :pk',
  };

  const command = new QueryCommand(params);

  try {
    const data = await dbClient.send(command);

    const results = data?.Items ?? [];
    const normalizedDynamoDBArray = results.map(unmarshall);

    return normalizedDynamoDBArray.map(chat => {
      const recepientUserId = chat.SK.split('#')[1];

      return {
        conversationType: chat.conversationType,
        conversationId: getConversationIdFromTwoUsers(userId, recepientUserId),
        to: recepientUserId,
        lastMessageData: chat.lastMessageData
      }
    });
  } catch (err) {
    console.error("Error querying table:", err);
    throw err;
  }
};
