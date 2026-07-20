const ac = new AbortController();
setTimeout(() => ac.abort(), 100);
try {
    fetch('https://www.fdedomestic.com/api/parcel/new_api_v1.php', { signal: ac.signal }).then(() => console.log('done')).catch(e => console.log('caught', e.message));
} catch (e) {}
