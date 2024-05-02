Channels:
PK: CHANNEL#<CHANNEL_UUID>
SK: CHANNEL#<CHANNEL_UUID>
firstMessageDate: <date> // first message date in order to know when to stop querying data in message history
subscribersCount: <number> // synced with users chats
messagesCount: <number> // number of messages in a channel
lastMessageData: { previewText: <string>, messageTime: <date>, id: <DAY>#<CHANNEL_UUID>#<MESSAGE_KSUID> }

Channel messages day metadata:
PK: CHANNEL#<CHANNEL_UUID>#<DAY>
SK: MEDATADATA
messagesCount: <number> // number of messages for a given day

Channel messages:
PK: CHANNEL#<CHANNEL_UUID>#<DAY>
SK: MESSAGE#<MESSAGE_KSUID> // we can easily query for latest day messages as they are sorted already
viewsCount: <number> // number of message views

---

Conversations:
PK: CONVERSATION#<CONVERSATION_UUID>
SK: CONVERSATION#<CONVERSATION_UUID>
type: USER / GROUP // conversation type
messagesCount: <number> // number of messages in a conversation
firstMessageDate: <Date> // first message date in order to know when to stop querying data in message history

Conversation messages:
PK: CONVERSATION#<CONVERSATION_UUID>#<DAY>
SK: MESSAGE#<MESSAGE_KSUID> // we can easily query for latest day messages as they are sorted

When user writes message to someone it will create conversation with partition CONVERSATION#<USER1_UUID>-<USER2_UUID> (depending who started this conversation)
Also both users will have link to that conversation entity. and If one deletes his conversation and sends message it will find this conversation object
and write message to it

---

User chats:
PK: USER_CHATS#<USER_UUID>
SK: CONVERSATION#<CONVERSATION_UUID> / CHANNEL#<CHANNEL_UUID>
type: USER / GROUP / CHANNEL
lastReadMessageId: CHANNEL#<CHANNEL_UUID>#<DAY>##<MESSAGE_KSUID> / CONVERSATION#<CHANNEL_UUID>#<DAY>#<MESSAGE_KSUID> // last read message ID
readMessagesCount: <number> // number of read messages in this channel

-- for channels subscribers list --
GSI1PK: CHANNEL#<CHANNEL_UUID>
GSI1SK: SUBSCRIBER#<USER_UUID>

-- for group conversations subscribers list --
GSI2PK: CONVERSATION#<CONVERSATION_UUID>
GSI2SK: SUBSCRIBER#<USER_UUID>
