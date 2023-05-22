const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const axios = require("axios");

let token = `eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJLTEE2a0NHLWJkdkR3TmFXUS0tTDhxN242RkFHZGx1ZmhhaUZ2a3dqTktBIn0.eyJleHAiOjE2ODQ3NzMwNzUsImlhdCI6MTY4NDc1NTA3NSwianRpIjoiYjI2MDY1MDgtOTA2Yy00YTUzLWEwZDUtYzVmZTZhNzg1MDgxIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLmF1LWF3cy50aGV3aXNobGlzdC5pby9hdXRoL3JlYWxtcy9zaG9uYS1qb3ktZGV2IiwiYXVkIjoiYWNjb3VudCIsInN1YiI6ImMxMmUyNzI0LWZjZTQtNDVlZi1hZWRmLWE3NjgyZTViY2U5NyIsInR5cCI6IkJlYXJlciIsImF6cCI6InR3Y19hZG1pbiIsImFjciI6IjEiLCJhbGxvd2VkLW9yaWdpbnMiOlsiaHR0cHM6Ly9jb25zb2xlLmF1LWF3cy50aGV3aXNobGlzdC5pbyIsImh0dHBzOi8vYXBpLmF1LWF3cy50aGV3aXNobGlzdC5pbyJdLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoiZW1haWwgcHJvZmlsZSIsImNsaWVudElkIjoidHdjX2FkbWluIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJjbGllbnRIb3N0IjoiMTkyLjE2OC4xNTUuMTQ2IiwicHJlZmVycmVkX3VzZXJuYW1lIjoic2VydmljZS1hY2NvdW50LXR3Y19hZG1pbiIsImNsaWVudEFkZHJlc3MiOiIxOTIuMTY4LjE1NS4xNDYifQ.lBBYnQ2qzn_CaZVxcpLV1jzMrZji9RPvSmgcPbvmXygdLzht5RkSXwoOxlCVHK84ylAtzggFLstyxQSI_yUW4MyF3LYQRiw-i8W-FJ60o9dObDDtY_EcZnNmGaXW7Aaw5a3nJMc1Ta5gMawSmeXdzgoz0uSs7-rrJkUdTlR40Weah3uK_s2bpI7q_wWIdFKVFq9OrxtajueRpzNA0TmQEMtWX8UIy7BSpP3mIAOMIC6GwZgNm4EyP0wJqgU4Klhef0BIYRGFhw4ihimCq3uCzwUtD9LitcW-JJiHvUgOK1s6GBkpEYeoD6uiLmKw4QIZWp8ZLMjKzv9r1MFEboY5Wg`;
const results = {};

const RATE_LIMIT_TWC = 15;
const TENANT_ID = "shona-joy-dev";
const TENANT_SECRET = "d3aBWX05Hf13WjT6pUBy0F";

function chunk(items, size) {
  const chunks = [];
  items = [].concat(...items);

  while (items.length) {
    chunks.push(items.splice(0, size));
  }

  return chunks;
}

const readFileCsv = async () => {
  const filePath = path.join(__dirname, "./variants/product-variant-shona.csv");
  const workbook = XLSX.readFile(filePath);
  const sheet_name_list = workbook.SheetNames;
  const variants = XLSX.utils.sheet_to_json(
    workbook.Sheets[sheet_name_list[0]]
  );

  const countVariant = variants.length;
  let index = 0;

  const variantChunks = chunk(variants, RATE_LIMIT_TWC);
  for (const variantChunk of variantChunks) {
    console.log(
      `Checking product variant - index: ${
        index * RATE_LIMIT_TWC + 1
      }/${countVariant}`
    );

    await Promise.all(
      variantChunk.map((variant) =>
        checkProductVariantInTWC(variant, TENANT_ID)
      )
    );

    await new Promise((rs) => setTimeout(rs, 500));

    index++;
  }

  // for (const variant of variants) {
  //   const { product_id, variant_id } = variant;
  //   console.log(
  //     `Checking product: ${product_id} variant ${variant_id} - index: ${++index}/${countVariant}`
  //   );
  //   await checkProductVariantInTWC(variant, TENANT_ID);
  // }

  console.log(`Total length variant not sync: ${Object.keys(results).length}`);
  fs.writeFileSync("./shona-joy-dev.json", JSON.stringify(results, null, 2));
};

const getAccessToken = async ({ tenant_id, client_secret }) => {
  try {
    const { status, data } = await axios({
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      url: `https://auth.au-aws.thewishlist.io/auth/realms/${tenant_id}/protocol/openid-connect/token`,
      data: `client_id=${encodeURIComponent(
        "twc_admin"
      )}&client_secret=${encodeURIComponent(
        client_secret
      )}&grant_type=${encodeURIComponent("client_credentials")}`,
    });

    if (status === 200) {
      token = data.access_token;
      console.log(data.access_token);
    }
  } catch (err) {
    console.log("Get Token Err: ", err.message);
  }
};

const checkProductVariantInTWC = async (
  { product_id, variant_id, payload },
  tenant_id
) => {
  let index = 0;
  let totalRetries = 3;
  for (index = 0; index < totalRetries; index++) {
    try {
      const { status } = await axios({
        method: "GET",
        headers: {
          "X-TWC-Tenant": tenant_id,
          Authorization: `Bearer ${token}`,
        },
        url: `https://api.au-aws.thewishlist.io/services/shopifyconnect/api/products/${product_id}/variants/${variant_id}`,
      });
      if (status === 200) {
        return true;
      }
    } catch (err) {
      console.log("ERR:", err.message);
      if (err.response?.status === 401) {
        await getAccessToken({
          tenant_id: TENANT_ID,
          client_secret: TENANT_SECRET,
        });
      }
    }
  }

  if (index === totalRetries) {
    console.log(
      `ERR: product: ${product_id} variant ${variant_id} - index retries: ${index}`
    );
    results[variant_id] = payload;
    return false;
  }
};

const restoreProductVariants = async () => {
  const variantJSON = require(path.join(__dirname, "./shona-joy-dev.json"));
  const variants = Object.values(variantJSON).map((e) => JSON.parse(e));
  const variantChunks = chunk(variants, RATE_LIMIT_TWC);

  const countVariant = variants.length;
  let index = 0;
  // for (const vChunk of variantChunks) {
  //   console.log(
  //     `Create product variant - index: ${
  //       index * RATE_LIMIT_TWC + 1
  //     }/${countVariant}`
  //   );
  //   await Promise.all(vChunk.map((variant) => saveProductVariantTWC(variant)));
  // }

  for (const variant of variants) {
    const { product_id, id: variant_id } = variant;
    console.log(
      `Create product: ${product_id} variant ${variant_id} - index: ${++index}/${countVariant}`
    );
    await saveProductVariantTWC(variant, TENANT_ID);
  }
};

const saveProductVariantTWC = async (variant, tenant_id) => {
  let index = 0;
  let totalRetries = 3;
  const { product_id, id: variant_id } = variant;

  for (index = 0; index < totalRetries; index++) {
    try {
      const isExist = await checkProductVariantInTWC(
        {
          product_id,
          variant_id,
        },
        TENANT_ID
      );
      if (isExist) {
        console.log(`Product: ${product_id} variant ${variant_id} is exists`);
        return false;
      }

      const { status, data } = await axios({
        method: "POST",
        headers: {
          "X-TWC-Tenant": tenant_id,
          Authorization: `Bearer ${token}`,
        },
        url: `https://api.au-aws.thewishlist.io/services/shopifyconnect/api/products/variants`,
        data: variant,
      });
      // console.log({
      //   status,
      //   data,
      //   variant,
      // });
      if (status === 200) {
        return true;
      }
    } catch (err) {
      console.log("Save Variant ERR:", err.message);
      if (err.response?.status === 401) {
        await getAccessToken({
          tenant_id: TENANT_ID,
          client_secret: TENANT_SECRET,
        });
      }
    }
  }

  if (index === totalRetries) {
    console.log(
      `ERR: Create product: ${product_id} variant ${variant_id} failed`
    );
    return false;
  }
};

readFileCsv();
// restoreProductVariants();

// getAccessToken({
//   tenant_id: "shona-joy-dev",
//   client_secret: "d3aBWX05Hf13WjT6pUBy0F",
// });
