// Content script entrypoint
import { defineContentScript } from "wxt/utils/define-content-script";

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    console.log("OpenStarter extension content script loaded");
  },
});