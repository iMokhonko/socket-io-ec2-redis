const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall, marshall } = require("@aws-sdk/util-dynamodb");
const generatePartitionPostfix = require('../helpers/generate-partition-postfix');

const dbClient = new DynamoDBClient({ region: 'eu-central-1' });
const TABLE_NAME = "test-table";

module.exports = async ({ conversationId, date, paginationToken } = {}, callback) => {
  const paginationPostfix = generatePartitionPostfix(new Date(date));

  const params = {
    TableName: TABLE_NAME,

    ExpressionAttributeNames: { 
      '#pk': 'PK',
      '#sk': 'SK'
    },

    ExpressionAttributeValues: marshall({ 
      ':pk': `CONVERSATION#${conversationId}#${paginationPostfix}`,
      ':sk': 'MESSAGE#' 
    }),

    KeyConditionExpression: '#pk = :pk and begins_with(#sk, :sk)',

    Limit: 10,

    // if pagination token exist
    ...(paginationToken && { 
      ExclusiveStartKey: marshall({
        PK: `CONVERSATION#${conversationId}#${paginationPostfix}`,
        SK: `MESSAGE#${paginationToken}` // pagination token is just last message KSUID in this partition
      }) 
    }),

    ScanIndexForward: false
  };

  const command = new QueryCommand(params);

  try {
    const data = await dbClient.send(command);

    const normalizedResult = (data?.Items ?? []).map(unmarshall);

    callback({ 
      result: normalizedResult,
      paginationNextToken: data?.LastEvaluatedKey?.SK.S.split('#')[1] ?? null
    });
  } catch (err) {
    console.error("Error querying table:", err);
    throw err;
  }
};
