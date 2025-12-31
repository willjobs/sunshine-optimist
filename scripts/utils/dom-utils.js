export const setText = (node, value) => {
  if (!node) {
    return;
  }
  node.textContent = value === null ? "" : String(value);
};

export const setInputValue = (node, value) => {
  if (!node) {
    return;
  }
  node.value = value === null ? "" : String(value);
};

export const getText = (node) => (node?.textContent || "").trim();
