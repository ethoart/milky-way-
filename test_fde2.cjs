const targetUrl = 'https://www.fdedomestic.com/api/parcel/new_api_v1.php';
const formData = new FormData();
formData.append('api_key', 'apkx1000pykx');
formData.append('client_id', '1000');
formData.append('order_id', '124578');
formData.append('parcel_weight', '3');
formData.append('parcel_description', 'api sample');
formData.append('recipient_name', 'Sudeshi Perera');
formData.append('recipient_contact_1', '');
formData.append('recipient_contact_2', '');
formData.append('recipient_address', '1st lane, Samudu Road');
formData.append('recipient_city', 'Matara');
formData.append('amount', '1500');
formData.append('exchange', '0');

async function run() {
    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            body: formData
        });
        const text = await response.text();
        console.log("Status:", response.status);
        console.log("Response:", text.slice(0, 100));
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
