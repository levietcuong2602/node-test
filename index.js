var axios = require("axios");
var FormData = require("form-data");
var fs = require("fs");
var data = new FormData();
data.append("file", fs.createReadStream("./test.png"));

console.log({
  ...data.getHeaders(),
});
var config = {
  method: "post",
  url: "https://iqvg7bz7yb.execute-api.ap-southeast-2.amazonaws.com/v1/images",
  headers: {
    "X-TWC-Tenant": "sosctest1022",
    ...data.getHeaders(),
  },
  data: data,
};

console.log({
  method: "post",
  url: "https://iqvg7bz7yb.execute-api.ap-southeast-2.amazonaws.com/v1/images",
  headers: {
    "X-TWC-Tenant": "sosctest1022",
    ...data.getHeaders(),
  },
  data: data,
});

axios(config)
  .then(function (response) {
    // console.log(response);
    console.log(JSON.stringify(response.data));
  })
  .catch(function (error) {
    console.log(error);
  });
