const app = require("express")();
const fetch = require("node-fetch");
require('dotenv').config()

const g = {
  tsdUrlCapTok: "https://data.tsd.usit.no/capability_token",
  tsdUrlUpload: `https://data.tsd.usit.no/v1/${process.env.TSD_PROJECT}/files/stream/${process.env.TSD_GROUP}/`,
  linkId: process.env.LINK_ID,
  port: parseInt(process.env.PORT),
};

const listener = app.listen(g.port, () => {
  console.log("Listening on port " + listener.address().port);
});

app.put('/upload', async (req, res, _) => {
  try {
    // has filename?
    const file_name = req.query.filename;
    if (!file_name) {
      throw new Error('missing filename param');
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
    const r = await fetch(`${g.tsdUrlUpload}/${encodeURI(file_name)}`, {
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
    res.status(500).json({error: e.message});
    return;
  }
});
