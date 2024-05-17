const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");

const dbClient = new DynamoDBClient({ region: 'eu-central-1' });
const TABLE_NAME = "chat-table";


module.exports = async (userId, payload = {}) => {
  // used for splition users by buckets
  // each username should be at least 3 chars
  // so we can create bucket with users first 3 chars
  // and query begins_with for sort key which will contain full username

  // this will decrease load because when user want to search for someone it will spread load between partitions
  const gsi1pk = userId.slice(0, 3);

  const params = {
    TableName: TABLE_NAME,
    Item: marshall({
      PK: `USER#${userId}`,
      SK: `USER#${userId}`,
      isOnline: true,
      lastSeen: Date.now(),
      ...payload,

      GSI1PK: `USER#${gsi1pk}`,
      GSI1SK: `USER#${userId}`
    }),
  };

  try {
    return await dbClient.send(new PutItemCommand(params));
  } catch (err) {
    console.error("Error upserting item:", err);

    return null;
  }
};