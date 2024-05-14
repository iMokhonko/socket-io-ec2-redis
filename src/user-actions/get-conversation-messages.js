const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall, marshall } = require("@aws-sdk/util-dynamodb");
const getBucketKey = require('../helpers/get-bucket-key');

const dbClient = new DynamoDBClient({ region: 'eu-central-1' });
const TABLE_NAME = "test-table";


// Get previous messages bucket Key
const getPrevMessagesBucketKey = async (conversationId, currentDateTimestamp) => {
  const command = new QueryCommand({
    TableName: TABLE_NAME,

    ExpressionAttributeNames: { 
      '#pk': 'PK',
      '#sk': 'SK'
    },

    ExpressionAttributeValues: marshall({ 
      ':pk': `CONVERSATION#${conversationId}`,
      ':sk': `PAGINATION_DATE#${currentDateTimestamp}` 
    }),

    KeyConditionExpression: '#pk = :pk and #sk < :sk',
    ScanIndexForward: false,
    Limit: 1
  });

  try {
    const data = await dbClient.send(command);

    const normalizedResult = (data?.Items ?? []).map(unmarshall);
    
    // [{ SK: 'PAGINATION_DATE#<unix timestamp>' }]
    // if null messages end reached (todo improve for case when users deletes conversation messages for himself)
    return normalizedResult?.[0]?.SK?.split('#')?.[1] ?? null;
  } catch (err) {
    console.error("Error querying table:", err);
    throw err;
  }
};

const getMessagesByBucketKey = async (conversationId, bucketKey, { limit = 10, paginationToken = null } = {}) => {
  const params = {
    TableName: TABLE_NAME,

    ExpressionAttributeNames: { 
      '#pk': 'PK',
      '#sk': 'SK'
    },

    ExpressionAttributeValues: marshall({ 
      ':pk': `CONVERSATION#${conversationId}#${bucketKey}`,
      ':sk': 'MESSAGE#' 
    }),

    KeyConditionExpression: '#pk = :pk and begins_with(#sk, :sk)',

    Limit: limit,

    // if pagination token exist
    ...(paginationToken && { 
      ExclusiveStartKey: marshall({
        PK: `CONVERSATION#${conversationId}#${bucketKey}`,
        SK: `MESSAGE#${paginationToken}` // pagination token is just last message KSUID in this partition
      }) 
    }),

    ScanIndexForward: false
  };


  try {
    const data = await dbClient.send(new QueryCommand(params));

    return {
      messages: (data?.Items ?? []).map(unmarshall),
      paginationToken: data?.LastEvaluatedKey?.SK.S.split('#')[1] ?? null
    };
  } catch (err) {
    console.error("Error querying table:", err);
    throw err;
  }
};


const getConversationMessages = async ({ 
  conversationId, 
  bucketKey = getBucketKey(new Date()), 
  paginationToken = null, 
  limit = 5,

  alreadyQueriedMessages = [] // current messages for merging
} = {}, callback) => {
  const { 
    messages, 
    paginationToken: nextPaginationToken 
  } = await getMessagesByBucketKey(conversationId, bucketKey, { limit, paginationToken });

  // if query has pagination token it means it has enough data (more than provided limit)
  // just return messages and pagination token
  if(nextPaginationToken) {
    return callback({ 
      messages: [...alreadyQueriedMessages, ...messages],

      conversationId,
      paginationToken: nextPaginationToken,
      bucketKey
    });
  }

  // in case next pagination token is not present
  // this means current bucket is empty
  if(!nextPaginationToken) {
    const prevBucketKey = await getPrevMessagesBucketKey(conversationId, bucketKey);

    // end of messages for this converstion is reached if not prevBucketKey is present
    // it means we reached last message bucket for this conversation and this bucket is already reached its end
    if(!prevBucketKey) {
      return callback({ 
        messages: [...alreadyQueriedMessages, ...messages],
  
        conversationId,
        paginationToken: null,
        bucketKey: null
      });
    }

    // in case if query limit is not reached
    if(messages.length < limit) {
      // query again with prev bucketKey
      return await getConversationMessages(
        { 
          conversationId, 
          bucketKey: prevBucketKey, 
          limit: limit - messages.length,
          alreadyQueriedMessages: [...alreadyQueriedMessages, ...messages]
        },
        callback
      );
    } else {
      // in case we reached query limit and current bucket reached its end
      // return only next bucketKey without paginationToken (paginationToken is used to paginate over bucket)
      return callback({ 
        messages: [...alreadyQueriedMessages, ...messages],
  
        conversationId,
        paginationToken: null,
        bucketKey: prevBucketKey
      });
    }
  }
};

module.exports = getConversationMessages;
