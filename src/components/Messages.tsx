import React from "react";

type MessagesProps = {
  messages: string[];
};

const Messages: React.FC<MessagesProps> = ({ messages }) => (
  <div>
    <h2>Messages</h2>
    {messages.map((msg, index) => (
      <p key={index}>{msg}</p>
    ))}
  </div>
);

export default Messages;
