const chunk = (items, size) => {
  const chunks = [];
  items = [].concat(...items);

  while (items.length) {
    chunks.push(items.splice(0, size));
  }

  return chunks;
};

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

module.exports = { chunk, sleep };
