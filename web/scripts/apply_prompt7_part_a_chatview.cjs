const fs = require('fs');
const path = require('path');

const chatViewPath = path.join(__dirname, '../src/components/ChatView.jsx');
let content = fs.readFileSync(chatViewPath, 'utf8');

// 1. Sender name color: always var(--link)
content = content.replace(
  'color: isOwn ? "var(--link)" : "var(--text)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>\r\n              {msgSenderName}',
  'color: "var(--link)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>\r\n              {msgSenderName}'
);
if (!content.includes('color: "var(--link)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>')) {
  // If \n instead of \r\n
  content = content.replace(
    'color: isOwn ? "var(--link)" : "var(--text)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>\n              {msgSenderName}',
    'color: "var(--link)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>\n              {msgSenderName}'
  );
}

// 2. Kebab button aria-label
content = content.replace(
  'title="More actions"\r\n                aria-label="More actions"',
  'title={t("moreOptions") || "More options"}\r\n                aria-label={t("moreOptions") || "More options"}'
);
content = content.replace(
  'title="More actions"\n                aria-label="More actions"',
  'title={t("moreOptions") || "More options"}\n                aria-label={t("moreOptions") || "More options"}'
);

// 3. Message body text overflowWrap:anywhere
content = content.replace(
  'style={{ fontSize: 14, lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "pre-wrap" }}',
  'style={{ fontSize: 14, lineHeight: 1.5, overflowWrap: "anywhere", wordBreak: "break-word", whiteSpace: "pre-wrap" }}'
);

// 4. Attachment item borderRadius and maxWidth
content = content.replace(
  'padding: "6px 10px",\r\n                      background: "var(--raised)",\r\n                      borderRadius: 8,\r\n                      border: `1px solid ${colors.border}`,\r\n                      fontSize: 12,',
  'padding: "6px 10px",\r\n                      background: "var(--raised)",\r\n                      borderRadius: "var(--r-md)",\r\n                      border: `1px solid ${colors.border}`,\r\n                      fontSize: 12,\r\n                      maxWidth: "100%",\r\n                      boxSizing: "border-box",'
);
content = content.replace(
  'padding: "6px 10px",\n                      background: "var(--raised)",\n                      borderRadius: 8,\n                      border: `1px solid ${colors.border}`,\n                      fontSize: 12,',
  'padding: "6px 10px",\n                      background: "var(--raised)",\n                      borderRadius: "var(--r-md)",\n                      border: `1px solid ${colors.border}`,\n                      fontSize: 12,\n                      maxWidth: "100%",\n                      boxSizing: "border-box",'
);

// 5. Timestamp fontSize: 12
content = content.replace(
  'fontSize: 11,\r\n              color: "var(--muted)",\r\n            }}\r\n          >\r\n            {Boolean(msg.edited_at)',
  'fontSize: 12,\r\n              color: "var(--muted)",\r\n            }}\r\n          >\r\n            {Boolean(msg.edited_at)'
);
content = content.replace(
  'fontSize: 11,\n              color: "var(--muted)",\n            }}\n          >\n            {Boolean(msg.edited_at)',
  'fontSize: 12,\n              color: "var(--muted)",\n            }}\n          >\n            {Boolean(msg.edited_at)'
);

// 6. Selection cancel aria-label
content = content.replace(
  'title="Cancel selection"\r\n                aria-label="Cancel selection"',
  'title={t("cancelSelection") || "Cancel selection"}\r\n                aria-label={t("cancelSelection") || "Cancel selection"}'
);
content = content.replace(
  'title="Cancel selection"\n                aria-label="Cancel selection"',
  'title={t("cancelSelection") || "Cancel selection"}\n                aria-label={t("cancelSelection") || "Cancel selection"}'
);

// 7. Bulk delete button class
content = content.replace(
  'className="icon-btn icon-btn-danger"\r\n                onClick={handleBulkDeleteSelected}\r\n                disabled={selectedMsgIds.size === 0}',
  'className="btn-text icon-btn-danger"\r\n                onClick={handleBulkDeleteSelected}\r\n                disabled={selectedMsgIds.size === 0}'
);
content = content.replace(
  'className="icon-btn icon-btn-danger"\n                onClick={handleBulkDeleteSelected}\n                disabled={selectedMsgIds.size === 0}',
  'className="btn-text icon-btn-danger"\n                onClick={handleBulkDeleteSelected}\n                disabled={selectedMsgIds.size === 0}'
);

// 8. Back button aria-label
content = content.replace(
  'title="Back to conversations"\r\n                  aria-label="Back to conversations"',
  'title={t("backToConversations") || "Back to conversations"}\r\n                  aria-label={t("backToConversations") || "Back to conversations"}'
);
content = content.replace(
  'title="Back to conversations"\n                  aria-label="Back to conversations"',
  'title={t("backToConversations") || "Back to conversations"}\n                  aria-label={t("backToConversations") || "Back to conversations"}'
);

// 9. Delete thread button aria-label
content = content.replace(
  'title={t("moveToTrash")}\r\n                >',
  'title={t("moveToTrash") || "Move to trash"}\r\n                  aria-label={t("moveToTrash") || "Move to trash"}\r\n                >'
);
content = content.replace(
  'title={t("moveToTrash")}\n                >',
  'title={t("moveToTrash") || "Move to trash"}\n                  aria-label={t("moveToTrash") || "Move to trash"}\n                >'
);

// 10. Search matches buttons aria-labels
content = content.replace(
  'title="Previous match"\r\n              aria-label="Previous match"',
  'title={t("previousMatch") || "Previous match"}\r\n              aria-label={t("previousMatch") || "Previous match"}'
);
content = content.replace(
  'title="Previous match"\n              aria-label="Previous match"',
  'title={t("previousMatch") || "Previous match"}\n              aria-label={t("previousMatch") || "Previous match"}'
);
content = content.replace(
  'title="Next match"\r\n              aria-label="Next match"',
  'title={t("nextMatch") || "Next match"}\r\n              aria-label={t("nextMatch") || "Next match"}'
);
content = content.replace(
  'title="Next match"\n              aria-label="Next match"',
  'title={t("nextMatch") || "Next match"}\n              aria-label={t("nextMatch") || "Next match"}'
);
content = content.replace(
  'title="Close search"\r\n              aria-label="Close search"',
  'title={t("closeSearch") || "Close search"}\r\n              aria-label={t("closeSearch") || "Close search"}'
);
content = content.replace(
  'title="Close search"\n              aria-label="Close search"',
  'title={t("closeSearch") || "Close search"}\n              aria-label={t("closeSearch") || "Close search"}'
);

// 11. Composer cancel reply
content = content.replace(
  'title="Cancel reply"\r\n              >',
  'title={t("cancelReply") || "Cancel reply"}\r\n                aria-label={t("cancelReply") || "Cancel reply"}\r\n              >'
);
content = content.replace(
  'title="Cancel reply"\n              >',
  'title={t("cancelReply") || "Cancel reply"}\n                aria-label={t("cancelReply") || "Cancel reply"}\n              >'
);

// 12. Remove attachment
content = content.replace(
  'title="Remove attachment"\r\n                  >',
  'title={t("removeAttachment") || "Remove attachment"}\r\n                    aria-label={t("removeAttachment") || "Remove attachment"}\r\n                  >'
);
content = content.replace(
  'title="Remove attachment"\n                  >',
  'title={t("removeAttachment") || "Remove attachment"}\n                    aria-label={t("removeAttachment") || "Remove attachment"}\n                  >'
);

// 13. Plus button more options
content = content.replace(
  'title="More options"\r\n                  aria-label="More options"',
  'title={t("moreOptions") || "More options"}\r\n                  aria-label={t("moreOptions") || "More options"}'
);
content = content.replace(
  'title="More options"\n                  aria-label="More options"',
  'title={t("moreOptions") || "More options"}\n                  aria-label={t("moreOptions") || "More options"}'
);

// 14. Mic buttons
content = content.replace(
  'title={isListening ? "Stop listening" : t("voiceToText")}\r\n                      aria-label={isListening ? "Stop listening" : t("voiceToText")}',
  'title={isListening ? (t("stopListening") || "Stop listening") : (t("voiceToText") || "Voice to text")}\r\n                      aria-label={isListening ? (t("stopListening") || "Stop listening") : (t("voiceToText") || "Voice to text")}'
);
content = content.replace(
  'title={isListening ? "Stop listening" : t("voiceToText")}\n                      aria-label={isListening ? "Stop listening" : t("voiceToText")}',
  'title={isListening ? (t("stopListening") || "Stop listening") : (t("voiceToText") || "Voice to text")}\n                      aria-label={isListening ? (t("stopListening") || "Stop listening") : (t("voiceToText") || "Voice to text")}'
);

// 15. Date separators in messages.map
const oldMapPattern = /\{messages\.map\(\(msg, index\) => \{[\s\S]*?const prevMsg = index > 0 \? messages\[index - 1\] : null;\s*const isSameGroup = prevMsg && prevMsg\.from_address === msg\.from_address;\s*const topGap = isSameGroup \? 2 : 12;\s*return \(\s*<MessageBubbleItem/m;

const newMapReplacement = `{messages.map((msg, index) => {
            const isOwn = msg.from_address === me?.email_address;
            const referencedMsg = msg.in_reply_to ? messagesMap.get(msg.in_reply_to) : null;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isSameGroup = prevMsg && prevMsg.from_address === msg.from_address;
            const topGap = isSameGroup ? 2 : 12;

            const msgDate = msg.created_at ? new Date(msg.created_at).toDateString() : null;
            const prevDate = prevMsg?.created_at ? new Date(prevMsg.created_at).toDateString() : null;
            const showDateSeparator = Boolean(msgDate && msgDate !== prevDate);
            const dateLabel = msg.created_at ? new Date(msg.created_at).toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
              ...(new Date(msg.created_at).getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {})
            }) : "";

            return (
              <React.Fragment key={msg.id || index}>
                {showDateSeparator && (
                  <div style={{ display: "flex", justifyContent: "center", margin: "16px 0 8px" }}>
                    <span
                      style={{
                        background: "var(--raised)",
                        borderRadius: 999,
                        fontSize: 12,
                        color: "var(--muted)",
                        padding: "4px 12px",
                        fontWeight: 500,
                        userSelect: "none",
                      }}
                    >
                      {dateLabel}
                    </span>
                  </div>
                )}
                <MessageBubbleItem`;

if (oldMapPattern.test(content)) {
  content = content.replace(oldMapPattern, newMapReplacement);
  // Also close the Fragment
  content = content.replace(
    'topGap={topGap}\r\n              />\r\n            );\r\n          })}',
    'topGap={showDateSeparator ? 6 : topGap}\r\n                />\r\n              </React.Fragment>\r\n            );\r\n          })}'
  );
  content = content.replace(
    'topGap={topGap}\n              />\n            );\n          })}',
    'topGap={showDateSeparator ? 6 : topGap}\n                />\n              </React.Fragment>\n            );\n          })}'
  );
  console.log('Date separators added to messages.map OK');
} else {
  console.error('messages.map pattern not found');
  process.exit(1);
}

fs.writeFileSync(chatViewPath, content, 'utf8');
console.log('ChatView.jsx updated for Part A OK');
