import React from "react";
import FolderListScreen from "./FolderListScreen";

export default function SpamScreen(props) {
  return <FolderListScreen {...props} folder="spam" title="Spam" emptyLabel="No spam. Nice inbox!" />;
}
