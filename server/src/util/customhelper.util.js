const fs = require('fs')
const moment = require('moment')
const LINQ = require('node-linq').LINQ
const os = require('os')
const { isNumberObject } = require('util/types')
const juice = require('juice')
const interfaces = os.networkInterfaces()
const axios = require('axios')

//#region READ & WRITE JSON FILES
exports.ReadJSONFile = function (filepath) {
  // console.log(Read JSON file: ${filepath});
  var data = fs.readFileSync(filepath, 'utf-8')
  // console.log(Contents: ${data});
  return JSON.parse(data)
}

exports.ReadFileBuffer = (filepath) => {
  var data = fs.readFileSync(filepath)

  return data
}

exports.GetFolderList = function (dir) {
  // console.log(Content: ${dir});
  var data = fs.readdirSync(dir)
  return data
}

exports.DeleteFile = (file) => {
  try {
    fs.unlinkSync(file)

    console.log('File is deleted.')
  } catch (error) {
    console.log(error)
  }
}

exports.GetFileListContains = (path, contains) => {
  try {
    var dataArr = []
    var data = fs.readdirSync(path, 'utf-8')

    data.forEach((d) => {
      if (d.includes(contains)) {
        // console.log(d);
        dataArr.push({
          file: d,
        })
      }
    })

    return dataArr
  } catch (error) {
    console.log(error)
  }
}

exports.GetFiles = function (dir) {
  //console.log(Content: ${dir});
  var data = fs.readdirSync(dir)
  return data
}

exports.CreateJSON = (filenamepath, data) => {
  // console.log(Create JSON Path: ${filenamepath} Content: ${data});
  fs.writeFileSync(filenamepath, data, (err) => {
    return err
  })
}

exports.CreateFolder = (dir) => {
  //console.log(Create folder: ${dir});
  if (fs.existsSync(dir)) {
    //console.log(Path exist: ${dir});
    return 'exist'
  } else {
    //console.log(Create path: ${dir});
    fs.mkdirSync(dir)
    return 'create'
  }
}

exports.RequestDetails = (data) => {
  // console.log(Request Details Extract: ${data});
  var result = []
  data.forEach((k, i) => {
    result.push({
      store: k.store,
      ticket: k.ticket,
      brandname: k.brandname,
      itemtype: k.itemtype,
      quantity: k.quantity,
      remarks: k.remarks,
    })
  })
  return result
}

//equipments item type
exports.Distinct = (data, indetifier, target) => {
  //console.log(Data: ${data} \nTarget: ${brandname});
  var unique = []

  if (indetifier == 'itemtype') {
    // itemtype
    unique = data.map((item) => {
      if (item.brandname == target) {
        return item.itemname
      }
    })
  }

  if (indetifier == 'brandname') {
    // brandname
    unique = [...new Set(data.map((item) => item.brandname))]
  }

  return unique
}

exports.MoveFile = (origin, destination) => {
  fs.renameSync(origin, destination)
  console.log(`Moved ${origin} to ${destination}`)
}

//#endregion

//#region  DATETIME
exports.GetCurrentYear = () => {
  return moment().format('YYYY')
}

exports.GetCurrentMonth = () => {
  return moment().format('MM')
}

exports.GetCurrentDay = () => {
  return moment().format('DD')
}

exports.GetCurrentDate = () => {
  return moment().format('YYYY-MM-DD')
}

exports.GetCurrentDatetime = () => {
  return moment().format('YYYY-MM-DD HH:mm')
}

exports.GetCurrentDatetimeSecconds = () => {
  return moment().format('YYYY-MM-DD HH:mm:ss')
}

exports.GetCurrentTime = () => {
  return moment().format('HH:mm')
}

exports.GetCurrentTimeSeconds = () => {
  return moment().format('HH:mm:ss')
}

exports.GetCurrentMonthFirstDay = () => {
  return moment().startOf('month').format('YYYY-MM-DD')
}

exports.GetPreviousMonthFirstDay = (months) => {
  return moment().subtract(months, 'months').startOf('month').format('YYYY-MM-DD')
}

exports.GetCurrentMonthLastDay = () => {
  return moment().endOf('month').format('YYYY-MM-DD')
}

exports.ConvertToDate = (datetime) => {
  return moment(`${datetime}`).format('YYYY-MM-DD')
}

exports.ConvertDate = (date) => {
  const dateObject = new Date(date)

  const year = dateObject.getFullYear()
  const month = (dateObject.getMonth() + 1).toString().padStart(2, '0')
  const day = dateObject.getDate().toString().padStart(2, '0')

  const formattedDate = `${year}-${month}-${day}`

  return formattedDate
}

exports.AddDayTime = (day, hour) => {
  let now = moment()
  let future = now.add({ days: day, hours: hour })

  return future.format('YYYY-MM-DD hh:mm')
}

exports.SubtractDayTime = (idate, fdate) => {
  const initaldate = moment(`${idate}`)
  const finaldate = moment(`${fdate}`)
  const diffInDays = finaldate.diff(initaldate, 'days')

  return diffInDays
}
//#endregion

//#region  SUMMARY REPORTS
exports.GetCablingEquipmentSummary = (target_folder) => {
  var data = []
  let folders = this.GetFolderList(target_folder)

  folders.forEach((folder) => {
    let targetDir = `${target_folder}${folder}`
    var files = this.GetFiles(targetDir)

    files.forEach((file) => {
      let filename = `${targetDir}/${file}`
      jsonData = this.ReadJSONFile(filename)

      jsonData.forEach((key, item) => {
        data.push({
          itemname: key.itemtype,
          itemcount: key.itemcount,
        })
      })
    })
  })

  return data
}

exports.GetRequestSummary = (it, tranfer, cabling) => {
  var data = []
  let itequipmentrequest = fs.readdirSync(it)
  let transferequipmentrequest = fs.readdirSync(tranfer)
  let cablingequipmentrequest = fs.readdirSync(cabling)

  data.push({
    itrequest: itequipmentrequest.length,
    transfer: transferequipmentrequest.length,
    cablingrequest: cablingequipmentrequest.length,
  })

  return data
}

exports.GetDetailedEquipmentSummary = (masterItemsDir, equipmentDir, department) => {
  try {
    let data
    let filter = []
    let itemsArr = this.GetFiles(masterItemsDir)
    let folders = this.GetFolderList(equipmentDir)

    console.log(`${masterItemsDir} - ${equipmentDir}`)

    let items_filter = new LINQ(itemsArr)
      .Where((item) => {
        return item.includes(department)
      })
      .OrderBy((item) => {
        return item
      })
      .ToArray()

    items_filter.forEach((item) => {
      let itemname = item.split('_')
      filter.push(itemname[0])
    })

    //read all json files in equipment folder on each folders
    ReadAllJSONFiles = (folders, root) => {
      let filesArr = []
      folders.forEach((folder) => {
        let targetFolder = `${root}${folder}`
        let files = this.GetFiles(targetFolder)

        files.forEach((file) => {
          filesArr.push({
            file: file,
          })
        })
      })

      return filesArr
    }
    //get item counts
    GetItemCountSummary = (files, filter) => {
      let items = []

      console.log(itemsArr)

      filter.forEach((item) => {
        let arr = new LINQ(files)
          .Where((t) => {
            return t.file.includes(item)
          })
          .OrderBy((t) => {
            return t.file
          })
          .ToArray()

        items.push({
          itemname: item,
          itemcount: arr.length,
        })
      })

      console.log(items)

      return items
    }

    let files = ReadAllJSONFiles(folders, equipmentDir)

    console.log(files)

    data = GetItemCountSummary(files, filter)

    //console.log(data)

    return data
  } catch (error) {
    throw error
  }
}

exports.GetEquipmentSummary = (target_folder) => {
  var data = []
  let folders = this.GetFolderList(target_folder)

  folders.forEach((folder) => {
    let targetFolder = `${target_folder}${folder}`
    var files = fs.readdirSync(targetFolder)
    data.push({
      itemname: folder,
      itemcount: files.length,
    })
  })

  return data
}
//#endregion

//#region
exports.UpdateCablingItemCount = (target_file, itemcount) => {
  let file = this.ReadJSONFile(target_file)
  let data = []

  console.log(`TARGET FILE: ${target_file} DEDUCTION: ${itemcount}`)
  let difference = 0
  file.forEach((key, item) => {
    let current_count = parseFloat(key.itemcount)
    let deduct = parseFloat(itemcount)
    difference = current_count - deduct
    let dataJson

    console.log(`${current_count} - ${deduct}`)

    data.push({
      brandname: key.brandname,
      itemtype: key.itemtype,
      itemcount: difference,
      updateby: key.updateby,
      updatedate: key.updatedate,
      createdby: key.createdby,
      createddate: key.createddate,
    })

    dataJson = JSON.stringify(data, null, 2)
    this.CreateJSON(target_file, dataJson)
  })
}
//#endregion

//#region USE LINQ for filtering json data
exports.GetByDeparmentItems = (data, index, callback) => {
  try {
    let arr = new LINQ(data)
      .Where((d) => {
        return d.department === index
      })
      .Select((d) => {
        return { brandname: d.brandname }
      })
      .ToArray()

    callback(null, arr)
  } catch (error) {
    callback(null, error)
  }
}

exports.GetByDeparmentPersonel = (data, index, callback) => {
  try {
    let arr = new LINQ(data)
      .Where((d) => {
        return d.positions === index
      })
      .Select((d) => {
        return { fullname: d.fullname }
      })
      .ToArray()

    callback(null, arr)
  } catch (error) {
    callback(null, error)
  }
}

exports.GetByClientStores = (data, index, callback) => {
  try {
    let arr = new LINQ(data)
      .Where((d) => {
        return d.clientname === index
      })
      .Select((d) => {
        return { storename: `${d.storenumber} ${d.storename}` }
      })
      .ToArray()

    callback(null, arr)
  } catch (error) {
    callback(null, error)
  }
}
//#endregion

//#region
exports.JSONNoSpace = (data) => {
  const jsonString = JSON.stringify(data, (key, value) => {
    if (typeof value === 'string') {
      return value.replace(/\s/g, '')
    }
    console.log(jsonString)
    return value
  })
}

exports.JSONRevert = (json) => {}
//#endregion

//#region number padding
exports.GeneratePO = (year, number) => {
  const padded = number.toString().padStart(4, '0')
  const ponumber = `${year}-${padded}`
  return ponumber
}
//#endregion

//#region array filters
exports.removeDuplicateSets = (arr) => {
  const uniqueSets = new Set(arr.map(JSON.stringify)) // Use JSON.stringify for comparison
  const result = Array.from(uniqueSets).map(JSON.parse)
  return result
}

exports.ConvertToJson = (data) => {
  const uniqueSets = new Set(data.map(JSON.stringify)) // Use JSON.stringify for comparison
  const result = Array.from(uniqueSets).map(JSON.parse)
  return result
}
//#endregion

exports.formatCurrency = (value) => {
  var formattedValue = parseFloat(value).toFixed(2)
  return '₱' + formattedValue.replace(/\d(?=(\d{3})+\.)/g, '$&,')
}

//#region Network Information

exports.getNetwork = () => {
  return new Promise((resolve, reject) => {
    Object.keys(interfaces).forEach((interfaceName) => {
      interfaces[interfaceName].forEach((iface) => {
        // Filter for IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          // console.log(`${interfaceName}: ${iface.address}`);
          resolve(`${iface.address}`)
        }
      })
    })
  })
}

exports.getNetworkv2 = () => {
  const interfaces = os.networkInterfaces()

  const allInterfaces = Object.values(interfaces).flat()

  const externalIpv4 = allInterfaces.find((iface) => {
    return iface.family === 'IPv4' && !iface.internal
  })

  if (externalIpv4) {
    return Promise.resolve(externalIpv4.address)
  } else {
    return Promise.reject(new Error('No external IPv4 address found.'))
  }
}

exports.getIPAddress = () => {
  return new Promise((resolve, reject) => {
    axios
      .get('https://api.ipify.org?format=json')
      .then((response) => {
        console.log(`Your IP address is: ${response.data.ip}`)
        resolve(response.data.ip)
      })
      .catch((error) => {
        reject(error)
        console.error('Error fetching IP address:', error)
      })
  })
}

//#endregion

//#region String Formatting
function capitalizeFirstLetter(str) {
  return str.toLowerCase().replace(/\b\w/g, function (char) {
    return char.toUpperCase()
  })
}
//#endregion

//#region SLQ SNIPPET CODE
exports.InsertStatement = (tablename, prefix, columns) => {
  let cols = ''

  columns.forEach((col) => {
    cols += `${prefix}_${col},`
  })

  cols = cols.slice(0, -1)

  let statement = `INSERT INTO ${tablename}(${cols}) VALUES ?`

  return statement
}

exports.InsertStatementTransCommit = (tablename, prefix, columns) => {
  let cols = ''
  let payload = ''

  columns.forEach((col) => {
    cols += `${prefix}_${col},`
    payload += `?,`
  })

  cols = cols.slice(0, -1)
  payload = payload.slice(0, -1)

  let statement = `INSERT INTO ${tablename}(${cols}) VALUES (${payload})`

  return statement
}

exports.InsertStatementNoPrefix = (tablename, columns) => {
  let cols = ''

  columns.forEach((col) => {
    cols += `${col},`
  })

  cols = cols.slice(0, -1)

  let statement = `INSERT INTO ${tablename}(${cols}) VALUES ?`

  return statement
}

exports.UpdateStatement = (tablename, prefix, columns, argument) => {
  let cols = ''
  let agrs = ''

  columns.forEach((col) => {
    cols += `${prefix}_${col} = ?,`
  })

  argument.forEach((arg) => {
    agrs += `${prefix}_${arg} = ? AND `
  })

  cols = cols.slice(0, -1)
  agrs = agrs.slice(0, -5)

  let statement = `UPDATE ${tablename} SET ${cols} WHERE ${agrs}`

  return statement
}

exports.UpdateStatementNoPrefix = (tablename, columns = [], argument = []) => {
  let cols = ''
  let agrs = ''

  columns.forEach((col) => {
    cols += `${col} = ?,`
  })

  argument.forEach((arg) => {
    agrs += `${arg} = ? AND `
  })

  cols = cols.slice(0, -1)
  agrs = agrs.slice(0, -5)

  let statement = `UPDATE ${tablename} SET ${cols} WHERE ${agrs}`

  return statement
}

exports.SelectStatement = (str, data) => {
  let statement = ''
  let found = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '?') {
      statement += `'${data[found]}'`
      found += 1
    } else {
      statement += str[i]
    }
  }
  return statement
}

exports.SelectAllStatement = (tablename, columns) => {
  let statement = `SELECT ${columns} FROM ${tablename}`

  return statement
}

exports.SelectStatementCondition = (tablename, columns = [], condition = []) => {
  let cols = ''
  let args = ''

  columns.forEach((col) => {
    cols += `${col},`
  })

  cols = cols.slice(0, -1)

  condition.forEach((arg) => {
    args += `${arg} = ? AND `
  })

  args = args.slice(0, -5)

  let statement = `SELECT ${cols} FROM ${tablename} WHERE ${args}`

  return statement
}

exports.DeleteStatement = (tablename, argument) => {
  let args = ''

  argument.forEach((col) => {
    args += `${col} = ? AND `
  })

  args = args.slice(0, -5)

  let statement = `DELETE FROM ${tablename} WHERE ${args}`

  return statement
}

exports.SelectInnerJoin = (columns = [], primaryTable, tableTojoinList = []) => {
  let select_statement = `SELECT `

  columns.forEach((col) => {
    select_statement += `${col},`
  })

  select_statement = select_statement.slice(0, -1)

  select_statement += ` FROM ${primaryTable}`

  tableTojoinList.forEach((table) => {
    const { table_name, primary, secondary, join_condition } = table

    select_statement += ` INNER JOIN ${table_name} ON ${primary} ${join_condition} ${secondary}`
  })

  return select_statement
}

exports.SelectInnerJoinCondition = (
  columns = [],
  primaryTable,
  tableTojoinList = [],
  condition = []
) => {
  let select_statement = `SELECT `

  columns.forEach((col) => {
    select_statement += `${col},`
  })

  select_statement = select_statement.slice(0, -1)

  select_statement += ` FROM ${primaryTable}`

  tableTojoinList.forEach((table) => {
    const { table_name, primary, secondary, join_condition } = table

    select_statement += ` INNER JOIN ${table_name} ON ${primary} ${join_condition} ${secondary}`
  })

  select_statement += ` WHERE `

  condition.forEach((arg) => {
    select_statement += `${arg} = ? AND `
  })

  select_statement = select_statement.slice(0, -5)

  return select_statement
}

//#endregion

//#region Manipulate strings
exports.getQuantity = (str) => {
  const charCount = {}
  let numbers = ''
  for (let char of str) {
    charCount[char] = charCount[char] ? charCount[char] + 1 : 1

    if (char == 'x') {
      return numbers
    } else {
      numbers += `${char}`
    }
  }

  return charCount
}
//#endregion

//#region Conversion Rate
exports.convert = (unit, unitdeduct) => {
  let ratio = 1

  switch (`${unit}:${unitdeduct}`) {
    case 'kg:mcg':
      return (ratio = 1 / 1e9)
    case 'kg:mg':
      return (ratio = 1 / 1e6)
    case 'kg:g':
      return (ratio = 1 / 1000)
    case 'kg:oz':
      return (ratio = 1 / 35.274)
    case 'kg:lb':
      return (ratio = 1 / 2.20462)
    case 'kg:mt':
      return (ratio = 1 / 0.001)
    case 'kg:t':
      return (ratio = 1 / 0.001)
    case 'kg:l':
      return (ratio = 1)
    case 'kg:ml':
      return (ratio = 0.001)
    case 'kg:kl':
      return (ratio = 1 / 0.001)
    case 'kg:gal':
      return (ratio = 1 / 0.264172)
    case 'g:mcg':
      return (ratio = 1 / 1000)
    case 'g:mg':
      return (ratio = 1 / 1000)
    case 'g:kg':
      return (ratio = 1000)
    case 'g:oz':
      return (ratio = 1 / 0.035274)
    case 'g:lb':
      return (ratio = 1 / 0.00220462)
    case 'g:mt':
      return (ratio = 1 / 1e-6)
    case 'g:t':
      return (ratio = 1 / 1e-6)
    case 'g:l':
      return (ratio = 1 / 1000)
    case 'g:ml':
      return (ratio = 1)
    case 'g:kl':
      return (ratio = 1 / 1e-6)
    case 'g:gal':
      return (ratio = 1 / 264.172)
    case 'mg:mcg':
      return (ratio = 1 / 1000)
    case 'mg:g':
      return (ratio = 1000)
    case 'mg:kg':
      return (ratio = 1e6)
    case 'mg:oz':
      return (ratio = 1 / 0.000035274)
    case 'mg:lb':
      return (ratio = 1 / 0.00000220462)
    case 'mg:mt':
      return (ratio = 1 / 1e-9)
    case 'mg:t':
      return (ratio = 1 / 1e-9)
    case 'mg:l':
      return (ratio = 1e6)
    case 'mg:ml':
      return (ratio = 1000)
    case 'mg:kl':
      return (ratio = 1 / 1e-9)
    case 'mg:gal':
      return (ratio = 1 / 3.78541e-6)
    case 'mcg:mg':
      return (ratio = 1000)
    case 'mcg:g':
      return (ratio = 1e6)
    case 'mcg:kg':
      return (ratio = 1e9)
    case 'mcg:oz':
      return (ratio = 1 / 3.5274e-8)
    case 'mcg:lb':
      return (ratio = 1 / 2.2046e-9)
    case 'mcg:mt':
      return (ratio = 1 / 1e-12)
    case 'mcg:t':
      return (ratio = 1 / 1e-12)
    case 'mcg:l':
      return (ratio = 1e9)
    case 'mcg:ml':
      return (ratio = 1e6)
    case 'mcg:kl':
      return (ratio = 1e12)
    case 'mcg:gal':
      return (ratio = 1 / 3.78541e-9)
    case 'l:ml':
      return (ratio = 1 / 1000)
    case 'l:kl':
      return (ratio = 1 / 0.001)
    case 'l:gal':
      return (ratio = 1 / 0.264172)
    case 'l:kg':
      return (ratio = 1)
    case 'ml:l':
      return (ratio = 1000)
    case 'ml:kl':
      return (ratio = 1e6)
    case 'ml:gal':
      return (ratio = 1 / 0.000264172)
    case 'ml:kg':
      return (ratio = 1000)
    case 'kl:l':
      return (ratio = 1 / 1000)
    case 'kl:ml':
      return (ratio = 1 / 1e6)
    case 'kl:gal':
      return (ratio = 1 / 264.172)
    case 'kl:kg':
      return (ratio = 1 / 1000)
    case 'gal:l':
      return (ratio = 0.264172)
    case 'gal:ml':
      return (ratio = 1 / 0.000264172)
    case 'gal:kl':
      return (ratio = 264.172)
    case 'gal:kg':
      return (ratio = 0.264172)
    default:
      return ratio
  }
}
//#endregion

//#region Email
const style = /*css*/ `@import url('https://fonts.googleapis.com/css2?family=Share+Tech&display=swap');
  body, table, td, a {-webkit-text-size-adjust: 100%;-ms-text-size-adjust: 100%;}
  table, td {mso-table-rspace: 0pt;mso-table-lspace: 0pt;}
  img {-ms-interpolation-mode: bicubic;}
  body {margin: 0; padding: 0; width: 100% !important;-webkit-font-smoothing: antialiased;}
  .container {max-width: 650px; margin: 2rem auto;}
  .container-lg {max-width: 900px; margin: 2rem auto;}
  .card {background-color: #fff; box-shadow: 0 .15rem 1.75rem 0 rgba(58, 59, 69, 0.15); border: 1px solid #dadada; border-radius: .3125rem; padding: 10px;}
  .card-header {text-align: center; font-size: 2.5rem; color: #34B1AA; padding: 10px;}
  .card-body {padding: 10px;}
  .card-footer {text-align: center; padding: 10px;}
  .divider {border: solid 1px #e4e4e4;}
  .label-title {color: #34B1AA; font-size: 1.25rem; margin-right: 0.35rem;}
  .text-left {text-align: left;}
  .table-container {border: 1px solid #e4e4e4; border-radius: .3125rem; width: 100%; margin: 1rem 0;}
  .table {width: 100%; border-collapse: collapse;}
  .table th, .table td {padding: .75rem; text-align: left; border-bottom: 1px solid #e4e4e4;}
  .table-header {background-color: #eaecf4;}
  .bmss-link {color: #d82a27;}
  .text-md {font-size: 1.25rem;}
  .row {display: flex; flex-wrap: wrap;}
  .col-full {flex: 0 0 100%; width: 100%;}
  .mt-1 {margin-top: 0.25rem;}
  .col-half {flex:0 0 50%;width:50%}
  .text-right {text-align: right !important;}`

exports.EmailContent = (details, items, receiver, supervisor) => {
  // Read and combine CSS files

  const { fromLocation, fromId, toLocation, toId, totalQuantity, notes, transferdate } = details[0]

  const itemRows = items
    .map(
      (item) => /*html*/ `<tr>
    <tr>
      <td>${item.productId}</td>
      <td>${item.productName}</td>
      <td>${item.quantity}</td>
    </tr>`
    )
    .join('')

  const template = /*html*/ `
    <html>
    <head></head>
    <body>
        <div class="container">
            <div class="card">
                <div class="card-header">
                    Transfer Details
                </div>
                <hr class="divider">
                <div class="card-body">
                    <div class="row">
                        <div class="col-full">
                            <span class="label-title">Supervisor:</span>
                            <span class="text-md">${supervisor}</span>
                        </div>
                    </div>
                    <div class="row mt-1">
                      <div class="col-full">
                          <span class="label-title">Recipient:</span>
                          <span class="text-md">${receiver}</span>
                      </div>
                    </div>
                    <div class="row mt-1">
                        <div class="col-full">
                            <span class="label-title">Date:</span>
                            <span class="text-md">${transferdate}</span>
                        </div>
                    </div>
                    <div class="row mt-1">
                        <div class="col-half">
                            <span class="label-title">From:</span>
                            <span class="text-md">${fromLocation} (${fromId})</span>
                        </div>
                        <div class="col-half">
                            <span class="label-title">To:</span>
                            <span class="text-md">${toLocation} (${toId})</span>
                        </div>
                    </div>
                    <div style="margin-top: 1rem;">
                        <div class="table-container">
                            <table class="table">
                                <thead class="table-header">
                                    <tr>
                                        <th>Product ID</th>
                                        <th>Product Name</th>
                                        <th>Quantity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemRows}
                                </tbody>
                                <tfoot>
                                  <tr>
                                      <td colspan="2" class="text-right">Total Quantity:</td>
                                      <td colspan="1">${totalQuantity}</td>
                                  </tr>
                              </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
                <hr class="divider">
                <div class="card-footer">
                    <span>Copyright &copy; Avesti Powered by </span> 
                    <a href="https://www.5lsolutions.com/" class="bmss-link">5L Solutions</a>
                </div>
            </div>
        </div>
    </body>
    </html>`

  const inlinedHtml = juice.inlineContent(template, style)
  return inlinedHtml
}

exports.ProductionEmail = (content, receiver, date, notes) => {
  const itemRows = content
    .map(
      (item) => /*html*/ `
        <tr>
          <td>${item.productionId}</td>
          <td>${item.productName}</td>
          <td>${item.quantity}</td>
          <td>${item.startDate}</td>
          <td>${item.endDate}</td>
          <td>${item.supervisor}</td>
        </tr>`
    )
    .join('')

  const template = /*html*/ `
    <html>
    <head></head>
    <body>
        <div class="container-lg">
            <div class="card">
                <div class="card-header">
                    Production Details
                </div>
                <hr class="divider">
                <div class="card-body">
                    <div class="row mt-1">
                      <div class="col-full">
                          <span class="label-title">Recipient:</span>
                          <span class="text-md">${receiver}</span>
                      </div>
                    </div>
                    <div class="row mt-1">
                        <div class="col-full">
                            <span class="label-title">Date:</span>
                            <span class="text-md">${date}</span>
                        </div>
                    </div>
                     <div class="row mt-1">
                        <div class="col-full">
                            <span class="label-title">JO#:</span>
                            <span class="text-md">${notes}</span>
                        </div>
                    </div>
                    <div style="margin-top: 1rem;">
                        <div class="table-container">
                            <table class="table">
                                <thead class="table-header">
                                    <tr>
                                        <th>Production ID</th>
                                        <th>Product Name</th>
                                        <th>Quantity</th>
                                        <th>Start Date</th>
                                        <th>End Date</th>
                                        <th>Supervisor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemRows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <hr class="divider">
                <div class="card-footer">
                    <span>Copyright &copy; Avesti Powered by </span> 
                    <a href="https://www.5lsolutions.com/" class="bmss-link">5L Solutions</a>
                </div>
            </div>
        </div>
    </body>
    </html>`

  const inlinedHtml = juice.inlineContent(template, style)
  return inlinedHtml
}

exports.StocksNotificationEmail = (content, receiver, date) => {
  const itemRows = content
    .map(
      (item) => /*html*/ `
        <tr>
          <td>${item.productname}</td>
          <td>${item.quantity}</td>
        </tr>`
    )
    .join('')

  const template = /*html*/ `
    <html>
    <head></head>
    <body>
        <div class="container-lg">
            <div class="card">
                <div class="card-header">
                    Stocks Alert
                </div>
                <hr class="divider">
                <div class="card-body">
                    <div class="row mt-1">
                      <div class="col-full">
                          <span class="label-title">Branch:</span>
                          <span class="text-md">${receiver}</span>
                      </div>
                    </div>
                    <div class="row mt-1">
                        <div class="col-full">
                            <span class="label-title">Date:</span>
                            <span class="text-md">${date}</span>
                        </div>
                    </div>
                    <div style="margin-top: 1rem;">
                        <div class="table-container">
                            <table class="table">
                                <thead class="table-header">
                                    <tr>
                                        <th>Product Name</th>
                                        <th>Quantity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemRows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <hr class="divider">
                <div class="card-footer">
                    <span>Copyright &copy; Avesti Powered by </span> 
                    <a href="https://www.5lsolutions.com/" class="bmss-link">5L Solutions</a>
                </div>
            </div>
        </div>
    </body>
    </html>`

  const inlinedHtml = juice.inlineContent(template, style)
  return inlinedHtml
}
//#endregion

//#region Convert Date
exports.formatDate = (dateTimeString) => {
  const date = new Date(dateTimeString)

  const options = { month: 'long', day: 'numeric', year: 'numeric' }
  const formattedDate = date.toLocaleDateString('en-US', options)

  let hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12
  const formattedTime = `${hours}:${minutes < 10 ? '0' : ''}${minutes} ${ampm}`

  return `${formattedDate} - ${formattedTime}`
}
//#endregion

exports.UnauthorizedTemplate = () => {
  const unauthorizedError = /*html*/ `
  <!DOCTYPE html>
  <html lang="en">

  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unauthorized Access</title>
    <!-- Bootstrap 4 CSS -->
    <link href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
    <style>
      body {
        background-color: #f8f9fa;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .error-container {
        text-align: center;
        background: white;
        border: 1px solid #e9ecef;
        border-radius: 8px;
        padding: 40px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
      }

      .error-title {
        font-size: 3rem;
        font-weight: 700;
        color: #dc3545;
      }

      .error-message {
        font-size: 1.25rem;
        margin: 20px 0;
        color: #6c757d;
      }
    </style>
  </head>

  <body>
    <div class="error-container">
      <h1 class="error-title">401</h1>
      <p class="error-message">Unauthorized</p>
      <p>You are not authorized to access this page.</p>
      <a href="/" class="btn btn-primary mt-3">Log In</a>
    </div>

    <!-- Bootstrap 4 JS and dependencies -->
    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.4.4/dist/umd/popper.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
  </body>

  </html>


  `

  return unauthorizedError
}

exports.SessionExpiredTemplate = () => {
  const unauthorizedError = /*html*/ `
  <!DOCTYPE html>
  <html lang="en">

  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Token Expired</title>
    <!-- Bootstrap 4 CSS -->
    <link href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
    <style>
      body {
        background-color: #f8f9fa;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .error-container {
        text-align: center;
        background: white;
        border: 1px solid #e9ecef;
        border-radius: 8px;
        padding: 40px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
      }

      .error-title {
        font-size: 3rem;
        font-weight: 700;
        color: #dc3545;
      }

      .error-message {
        font-size: 1.25rem;
        margin: 20px 0;
        color: #6c757d;
      }
    </style>
  </head>

  <body>
    <div class="error-container">
      <h1 class="error-title">401</h1>
      <p class="error-message">Token Expired</p>
      <p>Your session has expired. Please log in again.</p>
      <a href="/" class="btn btn-primary mt-3">Log In</a>
    </div>

    <!-- Bootstrap 4 JS and dependencies -->
    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.4.4/dist/umd/popper.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
  </body>

  </html>


  `

  return unauthorizedError
}

exports.SanitizeString = (str) => {
  // Remove leading and trailing whitespace
  str = str.trim()

  // Replace multiple spaces with a single space
  str = str.replace(/\s+/g, ' ')

  // Remove special characters except for alphanumeric characters, spaces, and underscores
  str = str.replace(/[^a-zA-Z0-9\s_]/g, '')

  // Convert to lowercase
  str = str.toLowerCase()

  return str
}
