const apiKey = 'AIzaSyBCF4lFlZFecrRPCZPCoPJRaUB3ZPGK2kk';
const spreadsheetId = '18ehCo3v-QeAyjEKump-ZffgsX2d2_Q2bljUaGvJvIK4';
const range = 'sheet1!A1:G';
const scriptURL = 'https://script.google.com/macros/s/AKfycbw3ZbmPghaM5CEg8f2PgXGobBTJkdPadMzExHfhWNtaevNt8W3lxCt81vw2ZDtt_SnJ/exec';

let sheetData = [];
let filteredData = [];
const itemsPerPage = 10;
let currentPage = 1;