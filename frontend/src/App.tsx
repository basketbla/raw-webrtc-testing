// App.tsx
import ClientComponent from "@/components/ClientComponent";
import ServerComponent from "@/components/ServerComponent";
import React, { useState } from "react";
import { Button } from "./components/ui/button";

const App: React.FC = () => {
  const [isServer, setIsServer] = useState<boolean | null>(null);

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold">Flask over WebRTC</h1>
      <div className="flex flex-row gap-3 my-4 mb-2">
        <Button onClick={() => setIsServer(true)}>Start Server</Button>
        <Button onClick={() => setIsServer(false)}>Start Client</Button>
      </div>
      {isServer ? (
        <ServerComponent />
      ) : isServer === false ? (
        <ClientComponent />
      ) : null}
    </div>
  );
};

export default App;
