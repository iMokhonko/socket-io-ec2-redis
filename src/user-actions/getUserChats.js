const { DynamoDBClient, QueryCommand, BatchGetItemCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall, marshall } = require("@aws-sdk/util-dynamodb");

const dbClient = new DynamoDBClient({ region: 'eu-central-1' });
const TABLE_NAME = "chat-table";

const getConversationIdFromTwoUsers = require('../helpers/get-conversation-id-from-two-users');

const getUsersStatuses = async (userIds = []) => {
  // Batch get item can allow up to 100 keys, we need to chunk data
  // TODO implement this later
  const params = {
    RequestItems: {
      [TABLE_NAME]: { // replace 'YourTableName' with the actual table name
        Keys: userIds.map(userId => marshall({ PK: `USER#${userId}`, SK: `USER#${userId}` }))
      },
    }
  };

  try {
    const command = new BatchGetItemCommand(params);
    const data = await dbClient.send(command);

    return (data?.Responses?.[TABLE_NAME] ?? []).map(({ PK, isOnline, lastSeen }) => ({
      userId: PK.S.split('#')[1],
      isOnline: isOnline.BOOL,
      lastSeen: parseInt(lastSeen.N)
    }));
  } catch (err) {
    return [];
  }
};

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

    const userChats = normalizedDynamoDBArray.map(chat => {
      const recepientUserId = chat.SK.split('#')[1];

      return {
        conversationType: chat.conversationType,
        conversationId: getConversationIdFromTwoUsers(userId, recepientUserId),
        to: recepientUserId,
        lastMessageData: chat.lastMessageData
      }
    });

    const users = await getUsersStatuses(userChats.map(({ to }) => to));
    
    return userChats.map(userChat => {
      const userMeta = users.find(meta => meta.userId === userChat.to);

      return {
        ...userChat,
        isOnline: userMeta?.isOnline ?? false,
        lastSeen: userMeta?.lastSeen ?? 0,
      }
    });
  } catch (err) {
    console.error("Error querying table:", err);
    throw err;
  }
};
