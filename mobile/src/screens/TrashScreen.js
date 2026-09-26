import React from "react";
import FolderListScreen from "./FolderListScreen";

export default function TrashScreen(props) {
  return <FolderListScreen {...props} folder="trash" title="Trash" emptyLabel="Trash is empty." />;
}
