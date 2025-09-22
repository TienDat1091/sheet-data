
const scriptURL = 'https://script.google.com/macros/s/AKfycbw3ZbmPghaM5CEg8f2PgXGobBTJkdPadMzExHfhWNtaevNt8W3lxCt81vw2ZDtt_SnJ/exec';
const form = document.forms['contact-form'];

form.addEventListener('submit', e => {
  e.preventDefault();

  fetch(scriptURL, {
    method: 'POST',
    body: new FormData(form)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Có lỗi khi gửi form. Mã lỗi: ' + response.status);
    }
    return response.json(); // Giả sử server trả về JSON
  })
  .then(data => {
    alert("Cảm ơn bạn! Form đã được gửi thành công: " + data.message);
    form.reset(); // Xóa dữ liệu form thay vì reload toàn bộ trang
  })
  .catch(error => {
    console.error('Lỗi!', error.message);
    alert('Đã xảy ra lỗi: ' + error.message);
  });
});