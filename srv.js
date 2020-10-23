const app = require("express")();
const fetch = require("node-fetch");
require('dotenv').config()

const g = {
  tsdUrlCapTok: "https://data.tsd.usit.no/capability_token",
  tsdUrlUpload: `https://data.tsd.usit.no/v1/${process.env.TSD_PROJECT}/files/stream/${process.env.TSD_GROUP}/`,
  linkId: process.env.LINK_ID,
  port: parseInt(process.env.PORT),
  allowedBuckets: (process.env.BUCKETS).split(/(\s+)/).filter( e => e.length > 1),
};

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
    // get token
    const cap_tok = await (async () => {
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
    // search for content-length field - uses null if not set
    const cl_key = Object.keys(req.headers).find(k => k.toLowerCase() === 'content-length');
    // stream to tsd
    const r = await fetch(`${g.tsdUrlUpload}/${encodeURI(bucket_id)}/${encodeURI(file_name)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${cap_tok}`,
        ...(!!cl_key && { 'Content-length' : req.headers[cl_key] }), // cond. dict entry
      },
      body: req,
    });
    if (!r.ok) {
      throw new Error(r.statusText);
    }
    res.sendStatus(r.status);
  } catch (e) {
    console.log(`${ts} error - ${e.message}`);
    res.status(500).json({error: e.message});
    return;
  }
  console.log(`${ts} ok`);
});
