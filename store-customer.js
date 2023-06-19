const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const axios = require("axios");
const url = require("url");

const { chunk, sleep } = require("./utils/util");

let token = `eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3TTdnUTlXeVlKSzVZSHJQNUh5dkN5dUJDaWd0NnB2SkNVcnVicXB2dGVVIn0.eyJleHAiOjE2ODcxODAzOTksImlhdCI6MTY4NzE2MjM5OSwianRpIjoiNGNhNjMwZTAtNGE1OC00MmEzLWI5ZjYtNzljZWY2YzdkM2M3IiwiaXNzIjoiaHR0cHM6Ly9hdXRoLmF1LWF3cy50aGV3aXNobGlzdC5pby9hdXRoL3JlYWxtcy92aWt0b3JpYS13b29kcyIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiJhMzM0YmIyYy1lMzcxLTQ5NTEtODUxNy1kNDQ0M2FkZDg5NTYiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJ0d2NfYWRtaW4iLCJhY3IiOiIxIiwiYWxsb3dlZC1vcmlnaW5zIjpbImh0dHBzOi8vY29uc29sZS5hdS1hd3MudGhld2lzaGxpc3QuaW8iLCJodHRwczovL2FwaS5hdS1hd3MudGhld2lzaGxpc3QuaW8iXSwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbIm9mZmxpbmVfYWNjZXNzIiwidW1hX2F1dGhvcml6YXRpb24iXX0sInJlc291cmNlX2FjY2VzcyI6eyJhY2NvdW50Ijp7InJvbGVzIjpbIm1hbmFnZS1hY2NvdW50IiwibWFuYWdlLWFjY291bnQtbGlua3MiLCJ2aWV3LXByb2ZpbGUiXX19LCJzY29wZSI6ImVtYWlsIHByb2ZpbGUiLCJjbGllbnRIb3N0IjoiMTkyLjE2OC4xNTcuMTA4IiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJjbGllbnRJZCI6InR3Y19hZG1pbiIsInByZWZlcnJlZF91c2VybmFtZSI6InNlcnZpY2UtYWNjb3VudC10d2NfYWRtaW4iLCJjbGllbnRBZGRyZXNzIjoiMTkyLjE2OC4xNTcuMTA4In0.g7W_6sfhSEiuazzftGok8mBUt5UHVVcMkPH3RmNHmVZLs7aPBAo0y4IALGGCkkZP8YLbzD9JG5iNKYh-VGXbCp9iJptdVePkY0yMml52-Ufp-D541BhPkw6AZt5ya1VxXcMbToNWZcKJD4oeJ6Wtl3dluk7ykR8ZZLYLsqBJQoacGP3VhNgVVXElXLPYaRCYKRt_EmafyjBKb3kS_W607gxTSo_cMxrhvsvWUi8ZAF9-hQR61Wb6xtRnnFO3lOx3gBb73RNB2IFou4RCbJ9lrs8RGRTG3QysCJuexjOHaVi05NGW4e7-ndogzw5s8e76s4-l0tX2I7LKRxxxOjmOpQ`;
const results = {};
const removeFailCustomerIds = [];

const RATE_LIMIT_TWC = 15;
const TENANT_ID = "viktoria-woods";
const TENANT_SECRET = "OZDJrXXhFByxcHWGxXP7oF";
const ENV_TWC = "aws";

const getAccessToken = async ({ tenant_id, client_secret }) => {
  try {
    const { status, data } = await axios({
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      url: `https://auth.au-${ENV_TWC}.thewishlist.io/auth/realms/${tenant_id}/protocol/openid-connect/token`,
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

const getListOrderFromShopify = async () => {
  try {
    const params = {
      limit: 6,
    };
    while (true) {
      console.log(JSON.stringify(params));
      const {
        headers: { link },
        data: { orders = [] },
      } = await axios({
        url: "https://sosctest148.myshopify.com/admin/api/2023-04/orders.json",
        params,
        headers: {
          "X-Shopify-Access-Token": "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",
        },
      });
      console.log("length: ", orders.length);
      console.log("link: ", link);
      if (!link) break;

      let newPageInfo = params.page_info;
      link.split(",").forEach((linkEl) => {
        const {
          query: { page_info: pageInfo },
        } = url.parse(linkEl, true);
        const matches = findPageInfoSubmatch(pageInfo.trim());
        if (matches[2] == "next") {
          newPageInfo = matches[1];
        }
      });
      if (newPageInfo === params.page_info) break;
      params.page_info = newPageInfo;
      await sleep(5000);
    }
  } catch (err) {
    console.log("ERR: ", err.message);
  }
};

// RESTORE CUSTOMER
const checkCustomerInTWC = async (customer, tenant_id) => {
  const { customer_id, payload } = customer;
  let index = 0;
  let totalRetries = 10;
  for (index = 0; index < totalRetries; index++) {
    try {
      const { status } = await axios({
        method: "GET",
        headers: {
          "X-TWC-Tenant": tenant_id,
          Authorization: `Bearer ${token}`,
        },
        url: `https://api.au-aws.thewishlist.io/services/shopifyconnect/api/customers/${customer_id}`,
      });
      if (status === 200) {
        return true;
      }
      await sleep(300);
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
    console.log(`ERR: customer ${customer_id} - index retries: ${index}`);
    results[customer_id] = payload;
  }
};

const readCustomerFromCsv = async () => {
  const filePath = path.join(
    __dirname,
    "./mr-poolman-missing-customer-retry-7.json"
  );

  // const workbook = XLSX.readFile(filePath);
  // const sheet_name_list = workbook.SheetNames;
  // const customers = XLSX.utils.sheet_to_json(
  //   workbook.Sheets[sheet_name_list[0]]
  // );
  const customerData = require(filePath);
  const customers = Object.keys(customerData).map((customer_id) => ({
    customer_id,
    payload: customers[customer_id],
  }));
  const countCustomer = customers.length;
  let index = 0;

  const customerChunks = chunk(customers, RATE_LIMIT_TWC);
  for (const customerChunk of customerChunks) {
    console.log(
      `Checking customer - index: ${
        index * RATE_LIMIT_TWC + 1
      }/${countCustomer}`
    );

    await Promise.all(
      customerChunk.map((customer) => checkCustomerInTWC(customer, TENANT_ID))
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

  console.log(`Total length customer not sync: ${Object.keys(results).length}`);
  fs.writeFileSync(
    "./mr-poolman-missing-customer-retry-7.json",
    JSON.stringify(results, null, 2)
  );
};

const uploadCustomerTWC = async (customer, tenant_id = TENANT_ID) => {
  let index = 0;
  let totalRetries = 3;
  const { id: customer_id } = customer;

  for (index = 0; index < totalRetries; index++) {
    try {
      const isExist = await checkCustomerInTWC(
        {
          customer_id,
          payload: customer,
        },
        TENANT_ID
      );
      if (isExist) {
        console.log(`Customer ${customer_id} is exists`);
        return false;
      }

      const { status, data } = await axios({
        method: "POST",
        headers: {
          "X-TWC-Tenant": tenant_id,
          Authorization: `Bearer ${token}`,
        },
        url: `https://api.au-${ENV_TWC}.thewishlist.io/services/shopifyconnect/api/customers`,
        data: customer,
      });
      if (status === 200) {
        return true;
      }
    } catch (err) {
      console.log("Save Customer ERR:", err.message);
      if (err.response?.status === 401) {
        await getAccessToken({
          tenant_id: TENANT_ID,
          client_secret: TENANT_SECRET,
        });
      }
    }
  }

  if (index === totalRetries) {
    console.log(JSON.stringify(customer));
    console.log(`ERR: create customers: ${customer_id} failed`);
    results[customer_id] = customer;
    return false;
  }
};

const restoreCustomers = async () => {
  const customerObj = require(path.join(
    __dirname,
    "./customers/mr-poolman-missing-customer-retry-7.json"
  ));
  const customers = Object.values(customerObj)
    .map((e) => JSON.parse(e))
    .map(({ email, ...rest }) => ({
      email: email && email.toLowerCase(),
      ...rest,
    }))
    .map((e) => convertCustomer(e));
  const customerChunks = chunk(customers, RATE_LIMIT_TWC);

  const countCustomers = customers.length;
  let index = 0;
  for (const vChunk of customerChunks) {
    console.log(
      `upload customers - index: ${
        index * RATE_LIMIT_TWC + 1
      }/${countCustomers}`
    );
    await Promise.all(vChunk.map((customer) => uploadCustomerTWC(customer)));
    await sleep(500);
    index++;
  }

  // for (const variant of customerChunks) {
  //   console.log(
  //     `Create product: ${product_id} variant ${variant_id} - index: ${++index}/${countVariant}`
  //   );
  //   await saveProductVariantTWC(variant, TENANT_ID);
  // }

  console.log(`Total length customer not sync: ${Object.keys(results).length}`);
  fs.writeFileSync(
    "./customers/mr-poolman-missing-customer-after-restore-1.json",
    JSON.stringify(results, null, 2)
  );
};

const convertCustomer = (customer) => {
  const {
    id,
    last_order_id,
    email,
    created_at,
    updated_at,
    accepts_marketing_updated_at,
    addresses = [],
    default_address,
    total_spent = 0,
  } = customer;

  const newCustomer = {
    ...customer,
    email: email && email.toLowerCase(),
    id: `${id}`,
    last_order_id: `${last_order_id}`,
    created_at: new Date(created_at).toISOString(),
    updated_at: new Date(updated_at).toISOString(),
    total_spent: total_spent && Number(total_spent),
    accepts_marketing_updated_at: new Date(
      accepts_marketing_updated_at
    ).toISOString(),
  };

  if (default_address) {
    newCustomer.default_address = {
      ...default_address,
      email: email && email.toLowerCase(),
      id: `${default_address.id}`,
      customer_id: `${default_address.customer_id || 0}`,
    };
  }
  if (addresses && addresses.length > 0) {
    newCustomer.addresses = addresses.map((addr) => ({
      ...addr,
      email: email && email.toLowerCase(),
      id: `${addr.id}`,
      customer_id: `${addr.customer_id || 0}`,
    }));
  }

  return newCustomer;
};

//  REMOVE CUSTOMERS
const removeChunkCustomers = async (customer_id) => {
  let index = 0;
  let totalRetries = 3;

  for (index = 0; index < totalRetries; index++) {
    try {
      const isExist = await checkCustomerInTWC(
        {
          customer_id,
          payload: { customer_id },
        },
        TENANT_ID
      );
      if (!isExist) {
        console.log(`Customer ${customer_id} doesn't exists`);
        return false;
      }

      const { status, data } = await axios({
        method: "DELETE",
        headers: {
          "X-TWC-Tenant": tenant_id,
          Authorization: `Bearer ${token}`,
        },
        url: `https://api.au-${ENV_TWC}.thewishlist.io/services/shopifyconnect/api/customers/${customer_id}`,
        data: customer,
      });
      if (status === 200) {
        return true;
      }
    } catch (err) {
      console.log(`Remove Customer ${customer_id} ERR:`, err.message);
      if (err.response?.status === 401) {
        await getAccessToken({
          tenant_id: TENANT_ID,
          client_secret: TENANT_SECRET,
        });
      }
    }
  }

  if (index === totalRetries) {
    console.log(`ERR: create customers: ${customer_id} failed`);
    removeFailCustomerIds.push(customer_id);
    return false;
  }
};

const removeCustomers = async () => {
  const customerIds = require(path.join(
    __dirname,
    "./customers/remove-customer-ids.json"
  ));
  const customerChunks = chunk(customerIds, RATE_LIMIT_TWC);

  const countCustomers = customerIds.length;
  let index = 0;
  for (const vChunk of customerChunks) {
    console.log(
      `Remove customers - index: ${
        index * RATE_LIMIT_TWC + 1
      }/${countCustomers}`
    );
    await Promise.all(vChunk.map((customer) => removeChunkCustomers(customer)));
    await sleep(500);
    index++;
  }

  // for (const variant of customerChunks) {
  //   console.log(
  //     `Create product: ${product_id} variant ${variant_id} - index: ${++index}/${countVariant}`
  //   );
  //   await saveProductVariantTWC(variant, TENANT_ID);
  // }

  console.log(
    `Total length customer not sync: ${
      Object.keys(removeFailCustomerIds).length
    }`
  );
  fs.writeFileSync(
    "./customers/remove-failed-customer-ids.json",
    JSON.stringify(removeFailCustomerIds, null, 2)
  );
};

// removeCustomers();

getAccessToken({
  tenant_id: TENANT_ID,
  client_secret: TENANT_SECRET,
});
