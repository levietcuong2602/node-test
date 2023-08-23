const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const readCustomerFromCsv = async () => {
  const filePath = path.join(__dirname, "./Thailand-Province.xlsx");

  const workbook = XLSX.readFile(filePath);
  const sheet_name_list = workbook.SheetNames;
  const provincesData = XLSX.utils.sheet_to_json(
    workbook.Sheets[sheet_name_list[0]]
  );

  const results = {};
  for (const row of provincesData) {
    const provinceEng = row["ProvinceEng"].toUpperCase();
    if (!results[provinceEng]) {
      results[provinceEng] = { districts: {} };
    }
    results[provinceEng].name_th = row["ProvinceThai"];
    results[provinceEng].code = row["ProvinceID"];
    results[provinceEng].geography = row["ภูมิภาคอย่างเป็นทางการ"];

    const districtEng = row["DistrictEng"].toUpperCase();
    if (!results[provinceEng].districts[districtEng]) {
      results[provinceEng].districts[districtEng] = {};
    }

    results[provinceEng].districts[districtEng].name_th = row["DistrictThai"];
  }

  console.log(`Total Provinces: ${Object.keys(results).length}`);
  fs.writeFileSync(
    "./provinces.json",
    JSON.stringify(
      Object.keys(results).map((key) => ({
        name_en: key,
        name_th: results[key].name_th,
        code: results[key].code,
        geography: results[key].geography,
        districts: Object.keys(results[key].districts).map((e) => ({
          name_en: e,
          name_th: results[key].districts[e].name_th,
        })),
      })),
      null,
      2
    )
  );
};

readCustomerFromCsv();
