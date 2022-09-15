const main = async () => {
  const auth_email =
    process.platform !== 'win32'
      ? process.env.auth_email
      : process.env.npm_package_auth_email; // The email used to login 'https://dash.cloudflare.com'
  const auth_method = 'global'; // Set to "global" for Global API Key or "token" for Scoped API Token
  const auth_key =
    process.platform !== 'win32'
      ? process.env.auth_key
      : process.env.npm_package_auth_key; // Your API Token or Global API Key
  const zone_identifier =
    process.platform !== 'win32'
      ? process.env.zone_identifier
      : process.env.npm_package_zone_identifier; // Can be found in the "Overview" tab of your domain
  const record_name =
    process.platform !== 'win32'
      ? process.env.record_name
      : process.env.npm_package_record_name; // Which record you want to be synced
  const ttl = '3600'; // Set the DNS TTL (seconds)
  const proxy = true; // Set the proxy to true or false

  const update_ip = async ip => {
    const default_headers = {
      'Content-type': 'application/json',
      'X-Auth-Email': auth_email,
    };
    // Set auth header based on global or token method
    const headers =
      auth_method === 'global'
        ? {
            ...default_headers,
            'X-Auth-Key': auth_key,
          }
        : { ...default_headers, Authorization: `Bearer ${auth_key}` };

    try {
      const fetch_res = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zone_identifier}/dns_records?type=A&name=${record_name}`,
        { headers }
      );
      const data = await fetch_res.json();
      if (data.result && data.result_info && data.result_info.count !== '0') {
        let flag = false;
        for (let i = 0; i < data.result.length; i++) {
          if (data.result[i].name === record_name) {
            if (data.result.content === ip) {
              return {
                error: false,
                data: 'IPv4 remains unchanged',
              };
            }
            const patch_res = await fetch(
              `https://api.cloudflare.com/client/v4/zones/${zone_identifier}/dns_records/${data.result[i].id}`,
              {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                  type: 'A',
                  name: record_name,
                  content: ip,
                  ttl: ttl,
                  proxied: proxy,
                }),
              }
            );
            const res = await patch_res.json();
            if (res) {
              return {
                error: false,
                data: `Updated A Record '${record_name}' to point to '${ip}'`,
              };
            }

            flag = true;
          }
        }
        if (!flag) {
          return {
            error: true,
            data: `Matching A Record '${record_name}' not found`,
          };
        }
      } else {
        return {
          error: true,
          data,
        };
      }
    } catch (err) {
      return {
        error: true,
        data: err.toString(),
      };
    }
  };

  const get_public_ipv4 = async () => {
    // Check if we have a public IP
    const ipv4_regex =
      /([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\.([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\.([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\.([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])/;

    try {
      const fetch_res = await fetch('https://cloudflare.com/cdn-cgi/trace');
      const data = await fetch_res.text();
      const ip_match = data.match(ipv4_regex);
      if (ip_match && ip_match[0]) {
        return { error: false, data: ip_match[0] };
      } else {
        // If cloudflare api doesn't return ip try using ipify
        const fetch_res = await fetch('https://api.ipify.org/');
        const data = await fetch_res.text();
        const ip_match_2 = data.match(ipv4_regex);
        if (ip_match_2 && ip_match_2[0]) {
          return { error: false, data: ip_match_2[0] };
        } else {
          return { error: true, data: 'Unable to grab public IP address' };
        }
      }
    } catch (err) {
      return { error: true, data: err.toString() };
    }
  };

  const run = async () => {
    const ipv4_res = await get_public_ipv4();
    // If an error occurs while grabbing the public IPv4 log message and return
    if (!ipv4_res) {
      console.error('Uncaught exception, no IPv4 response.');
      return;
    }
    if (ipv4_res.error) {
      console.error(ipv4_res.data);
      return;
    }

    const update_ip_res = await update_ip(ipv4_res.data);

    if (!update_ip_res) {
      console.error('Uncaught exception, no record update response.');
      return;
    }
    if (update_ip_res && update_ip_res.error) {
      console.error(update_ip_res.data);
      return;
    }

    console.log(update_ip_res.data);
  };

  // console.log(`process.platform: ${process.platform}`);
  run();
};
main();
