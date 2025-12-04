const http = require('http');

const PORT = 4040;

function sendCallback(callbackUrl, method, body, headers) {
    const url = new URL(callbackUrl);
    const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: method,
        headers: headers
    };

    const req = http.request(options, (res) => {
        console.log(`Callback ${method} ${callbackUrl} - Status: ${res.statusCode}`);
    });

    req.on('error', (e) => {
        console.error(`Callback error: ${e.message}`);
    });

    req.write(JSON.stringify(body));
    req.end();
}

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

    const source = req.headers['fspiop-source'];

    // GET /parties/{Type}/{ID}
    if (req.method === 'GET' && req.url.startsWith('/parties/')) {
        const parts = req.url.split('/');
        const idType = parts[2];
        const id = parts[3];

        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end();

        setTimeout(() => {
            const callbackBody = {
                party: {
                    partyIdInfo: {
                        partyIdType: idType,
                        partyIdentifier: id,
                        fspId: 'testdfsp'
                    },
                    name: 'Mock User',
                    personalInfo: {
                        complexName: {
                            firstName: 'Mock',
                            lastName: 'User'
                        }
                    }
                }
            };

            sendCallback(
                `http://mojaloop-connector-load-test:4000/parties/${idType}/${id}`,
                'PUT',
                callbackBody,
                {
                    'Content-Type': 'application/vnd.interoperability.parties+json;version=1.0',
                    'Date': new Date().toUTCString(),
                    'FSPIOP-Source': 'mock-hub',
                    'FSPIOP-Destination': source
                }
            );
        }, 100);
        return;
    }

    // POST /quotes
    if (req.method === 'POST' && req.url.startsWith('/quotes')) {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const quoteRequest = JSON.parse(body);
            const quoteId = quoteRequest.quoteId;

            res.writeHead(202, { 'Content-Type': 'application/json' });
            res.end();

            setTimeout(() => {
                const callbackBody = {
                    transferAmount: quoteRequest.amount,
                    expiration: new Date(Date.now() + 60000).toISOString(),
                    ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTIzNDU2Nzg5MAoKQ29udGVudC1MZW5ndGg6IDEzMQpDb250ZW50LVR5cGU6IGFwcGxpY2F0aW9uL2pzb24KU2VuZGVyLUlkZW50aWZpZXI6IDkyODA2MzkxNTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxNTFcIn0',
                    condition: '47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU',
                    payeeFspFee: {
                        amount: '0',
                        currency: quoteRequest.amount.currency
                    },
                    payeeFspCommission: {
                        amount: '0',
                        currency: quoteRequest.amount.currency
                    }
                };

                sendCallback(
                    `http://mojaloop-connector-load-test:4000/quotes/${quoteId}`,
                    'PUT',
                    callbackBody,
                    {
                        'Content-Type': 'application/vnd.interoperability.quotes+json;version=1.0',
                        'Date': new Date().toUTCString(),
                        'FSPIOP-Source': 'mock-hub',
                        'FSPIOP-Destination': source
                    }
                );
            }, 100);
        });
        return;
    }

    // POST /transfers
    if (req.method === 'POST' && req.url.startsWith('/transfers')) {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const transferRequest = JSON.parse(body);
            const transferId = transferRequest.transferId;

            res.writeHead(202, { 'Content-Type': 'application/json' });
            res.end();

            setTimeout(() => {
                const callbackBody = {
                    fulfilment: 'XoSz1cL0tljJSCp_VtIYmPNw-zFUgGfbUqf69AagUzY',
                    completedTimestamp: new Date().toISOString(),
                    transferState: 'COMMITTED'
                };

                sendCallback(
                    `http://mojaloop-connector-load-test:4000/transfers/${transferId}`,
                    'PUT',
                    callbackBody,
                    {
                        'Content-Type': 'application/vnd.interoperability.transfers+json;version=1.0',
                        'Date': new Date().toUTCString(),
                        'FSPIOP-Source': 'mock-hub',
                        'FSPIOP-Destination': source
                    }
                );
            }, 150);
        });
        return;
    }

    // Default - 202 pour tout le reste
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end();
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Mock Mojaloop Hub running on port ${PORT}`);
});
