/**
 * Network guard for JavaScript snippet tests.
 *
 * A snippet must never touch the network, neither when it runs nor when it is
 * tested. Rungs N2 and N3 use the local doubles in this directory.
 *
 * Loaded with `node --import` before the test files, so the guard is in place
 * before any snippet gets a chance to open a connection.
 */
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';

const message =
  'a snippet tried to reach the network. Rungs N2 and N3 are tested with the ' +
  'local doubles in content/snippets/_harness/.';

const refuse = () => {
  throw new Error(message);
};

globalThis.fetch = refuse;
net.connect = refuse;
net.createConnection = refuse;
http.request = refuse;
http.get = refuse;
https.request = refuse;
https.get = refuse;
dns.lookup = refuse;
dns.promises.lookup = refuse;
