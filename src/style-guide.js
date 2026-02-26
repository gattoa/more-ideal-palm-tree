const rootStyles = getComputedStyle(document.documentElement);

function readToken(tokenName) {
  return rootStyles.getPropertyValue(tokenName).trim();
}

function setTokenValues() {
  const tokenNodes = document.querySelectorAll("[data-token]");

  tokenNodes.forEach((node) => {
    const tokenName = node.getAttribute("data-token");
    const valueNode = node.querySelector(".token-value");

    if (!tokenName || !valueNode) {
      return;
    }

    valueNode.textContent = readToken(tokenName) || "(not set)";
  });
}

setTokenValues();
