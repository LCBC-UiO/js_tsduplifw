const app = require("express")();
const fetch = require("node-fetch");
const jwt_decode = require('jwt-decode');
require('dotenv').config()

const g = {
  tsdUrlCapTok: "https://data.tsd.usit.no/capability_token",
  tsdUrlUpload: `https://data.tsd.usit.no/v1/${process.env.TSD_PROJECT}/files/stream/${process.env.TSD_GROUP}/${process.env.REMOTE_DIR}`,
  linkId: process.env.LINK_ID,
  port: parseInt(process.env.PORT),
  allowedBuckets: (process.env.BUCKETS).split(/(\s+)/).filter( e => e.length > 1),
};

let g_cap_tok = null;

const listener = app.listen(g.port, () => {
  console.log("Listening on port " + listener.address().port);
});

app.put('/upload', async (req, res, _) => {
  const ts = (new Date()).getTime();
  try {
    // has filename?
    const file_name = req.query.filename;
    if (!file_name) {
      throw new Error('missing filename param');
    }
    // any ../ within file names?
    if (file_name.indexOf("../") != -1) {
      throw new Error('"../" not allowed within filename param');
    }
    // has bucket?
    const bucket_id = req.query.bucket;
    if (!bucket_id) {
      throw new Error('missing bucket param');
    }
    console.log(`${ts} streaming ${bucket_id} ${file_name}`);
    // bucket allowed?
    if (!g.allowedBuckets.includes(bucket_id)) {
      throw new Error(`bucket "${bucket_id}" is undefined`);
    }
    // do we have a valid jwt token?
    if (g_cap_tok) {
      const cap_tok_dec = jwt_decode(g_cap_tok);
      const ts_curr = Math.floor(new Date().getTime() / 1000); // get epoch
      const min_remaining_ttl_sec = 5*60;
      if (cap_tok_dec.exp - ts_curr < min_remaining_ttl_sec) {
        console.log(`cap token expired (${cap_tok_dec.exp}) at ${ts_curr}`);
        g_cap_tok = null;
      }
    }
    // new get token?
    if (!g_cap_tok) {
      console.log("getting new cap token");
      g_cap_tok = await (async () => {
        const r = await fetch(g.tsdUrlCapTok, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: g.linkId
          }),
        });
        if (!r.ok) {
          throw new Error(r.statusText);
        }
        const j = await r.json();
        return j.token;
      })();
    }
    // search for content-length field - uses null if not set
    const cl_key = Object.keys(req.headers).find(k => k.toLowerCase() === 'content-length');
    // stream to tsd
    const r = await fetch(`${g.tsdUrlUpload}/${encodeURI(bucket_id)}/${encodeURI(file_name)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${g_cap_tok}`,
        ...(!!cl_key && { 'Content-length' : req.headers[cl_key] }), // cond. dict entry
      },
      body: req,
    });
    if (!r.ok) {
      throw new Error(r.statusText);
    }
    console.log(`${ts} ok`);
    return res.sendStatus(r.status);
  } catch (e) {
    console.log(`${ts} error - ${e.message}`);
    return res.status(400).json({error: e.message});
  }
});
