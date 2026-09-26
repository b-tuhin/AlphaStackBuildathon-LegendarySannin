import React from "react";
import FolderListScreen from "./FolderListScreen";

export default function DraftsScreen(props) {
  return <FolderListScreen {...props} folder="drafts" title="Drafts" emptyLabel="No drafts saved." />;
}
