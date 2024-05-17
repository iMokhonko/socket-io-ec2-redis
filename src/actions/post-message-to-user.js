const { DynamoDBClient, TransactWriteItemsCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");

const dbClient = new DynamoDBClient({ region: 'eu-central-1' });
const ksuid = require('ksuid');
const getBucketKey = require('../helpers/get-bucket-key');
const getMidnightDate = require('../helpers/get-midnight-date');

const TABLE_NAME = "chat-table";

module.exports = async (socket, { to, from, text = '' } = {}, callback) => {
  // always generate the same conversationId for those users
	const conversationId = [to, from].sort().join(':');
  const messageId = (await ksuid.random()).string;

  const messageTime = Date.now();

	const params = {
    TransactItems: [
      // Create object that contains current bucket date and messages count for that bucket
      {
        Update: {
          TableName: TABLE_NAME,

          Key: marshall({
            PK: `CONVERSATION#${conversationId}`,
            SK: `PAGINATION_DATE#${getBucketKey()}`,
          }),

          ExpressionAttributeNames: { 
            '#messagesCount': 'messagesCount',
            '#date': 'date'
          },

          ExpressionAttributeValues: marshall({ 
            ':inc': 1,
            ':date': getMidnightDate()
          }),

          UpdateExpression: 'ADD #messagesCount :inc SET #date = :date',
        },
      },

      // add/update this conversation to user that should recieve this message
      {
				Update: {
					TableName: TABLE_NAME,

          Key: marshall({
            PK: `USER_CHATS#${to}`,
            SK:  `USER#${from}`
          }),

          ExpressionAttributeNames: {
            '#conversationId': 'conversationId',
            '#conversationType': 'conversationType',
            '#lastMessageData': 'lastMessageData'
          },

          ExpressionAttributeValues: marshall({
            ':conversationId': conversationId,
            ':type': 'USER',
            ':lastMessageData': {
              'from': from,
              'messageText': text,
              'messageTime': messageTime,
              'messageId': messageId
            }
          }),
          
          UpdateExpression: 'SET #conversationType = :type, #conversationId = :conversationId, #lastMessageData = :lastMessageData',
				}
			},

      // add message that user sent to this conversation
      {
				Put: {
					TableName: TABLE_NAME,
			
					Item: marshall({
						PK: `CONVERSATION#${conversationId}#${getBucketKey()}`,
						SK: `MESSAGE#${messageId}`,
						from,
            text: text,
            time: messageTime,
					}),
					
					ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
				}
			},
		]
	}

  if(to !== from) {
    // add/update this conversation to user that sent message
    params.TransactItems.push({
      Update: {
        TableName: TABLE_NAME,

        Key: marshall({
          PK: `USER_CHATS#${from}`,
          SK: `USER#${to}`
        }),

        ExpressionAttributeNames: {
          '#conversationId': 'conversationId',
          '#conversationType': 'conversationType',
          '#lastMessageData': 'lastMessageData'
        },

        ExpressionAttributeValues: marshall({
          ':conversationId': conversationId,
          ':type': 'USER',
          ':lastMessageData': {
            'from': from,
            'messageText': text,
            'messageTime': messageTime,
            'messageId': messageId
          }
        }),
        
        UpdateExpression: 'SET #conversationType = :type, #conversationId = :conversationId, #lastMessageData = :lastMessageData',
      }
    });
  }

	const command = new TransactWriteItemsCommand(params);

	try {
		await dbClient.send(command);

    const response = { 
      conversationId, 
      from, 
      to, 
      messageData: {
        from,
        messageText: text,
        messageTime
      }
    };

    socket.to(to).emit('incoming-message', response)

		callback({ 
      status: 'ok', 
      ...response,
    });
	} catch (err) {
		console.error(err);
	}
}