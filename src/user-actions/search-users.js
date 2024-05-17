const { DynamoDBClient, QueryCommand, BatchGetItemCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall, marshall } = require("@aws-sdk/util-dynamodb");

const dbClient = new DynamoDBClient({ region: 'eu-central-1' });
const TABLE_NAME = "chat-table";

const getConversationIdFromTwoUsers = require('../helpers/get-conversation-id-from-two-users');

module.exports = async ({ search: userId, currentUserId } = {}, callback) => {
  const bucketKey = `USER#${userId.slice(0, 3)}`;

  const params = {
    TableName: TABLE_NAME,
    IndexName: "GSI1",

    ExpressionAttributeNames: { 
      '#gsi1pk': 'GSI1PK' ,
      '#gsi1sk': 'GSI1SK'
    },

    ExpressionAttributeValues: marshall({ 
      ':gsi1pk': bucketKey,
      ':gsi1sk': `USER#${userId}`
    }),

    KeyConditionExpression: '#gsi1pk = :gsi1pk and begins_with(#gsi1sk, :gsi1sk)',

    Limit: 20
  };

  const command = new QueryCommand(params);

  try {
    const data = await dbClient.send(command);

    const results = data?.Items ?? [];
    const normalizedDynamoDBArray = results.map(unmarshall);

    const searchResults = normalizedDynamoDBArray.map(({ SK, isOnline, lastSeen }) => ({
      userId: SK.split('#')[1],
      isOnline,
      lastSeen,
      conversationId: getConversationIdFromTwoUsers(SK.split('#')[1], currentUserId)
    }));

    console.log('searchResults', searchResults)

    return callback({
      results: searchResults,
    });
  } catch (err) {
    console.error("Error querying table:", err);
    throw err;
  }
};
