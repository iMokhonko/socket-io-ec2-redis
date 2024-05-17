const { DynamoDBClient, TransactWriteItemsCommand } = require("@aws-sdk/client-dynamodb");
const dbClient = new DynamoDBClient({ region: 'eu-central-1' });

const ksuid = require('ksuid');

const TABLE_NAME = "chat-table";

module.exports = async ({ conversationName, owner = 'ivan.mokhonko' } = {}, callback) => {
	const conversationId = (await ksuid.random()).string;

	const params = {
    TransactItems: [
			{
				Put: {
					TableName: TABLE_NAME,

					Item: {
						PK: { S: `CONVERSATION#${conversationId}` },
						SK: { S: `CONVERSATION#${conversationId}` },
						name: { S: conversationName },
						chatType: { S: 'GROUP' },
						createdAt: { N: `${Date.now()}` },
						firstMessageDate: { N: '0' },
						membersCount: { N: '1' },
						messagesCount: { N: '0' },
						lastMessageData: { M: {} },
						owner: { S: owner }
					},
					
					ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
				}
			},
			{
				Put: {
					TableName: TABLE_NAME,

					Item: {
						PK: { S: `USER_CHATS#${owner}` },
						SK: { S: `CONVERSATION#${conversationId}` },
						chatType: { S: 'GROUP' },
						joinedAt: { N: `${Date.now()}` },
						readMessagesCount: { N: '0' },
					},
					
					ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
				}
			}
		]
	};

	
	const command = new TransactWriteItemsCommand(params);

	try {
		await dbClient.send(command);

		callback({ status: 'ok', conversationId });
	} catch (err) {
		console.error(err);
	}
}