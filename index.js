const fs = require("fs")
const axios = require("axios")

let submitQuestionsRequests = fs.readFileSync("submitQuestionsRequests.txt", "utf-8");
let questionIds = []

function parseRawRequests(rawRequests) {
    const requests = rawRequests.trim().split("\n\n\n");

    function parseRawRequest(rawRequest) {
        const [requestLine, ...headerLines] = rawRequest.trim().split("\n");
        const [method, url] = requestLine.split(" ").slice(0, 2);

        const headers = {};
        let body = "";

        let parsingHeaders = true;
        headerLines.forEach((line) => {
            if (parsingHeaders) {
                if (line.trim() === "") {
                    parsingHeaders = false;
                } else {
                    const [key, ...values] = line.split(": ");
                    headers[key] = values.join(": ");
                }
            } else {
                body += line;
            }
        });

        return { method, url, headers, body: JSON.parse(body.trim()) };
    }

    const parsedRequests = requests.map(parseRawRequest)
    parsedRequests.forEach(r => {
        if (r.body.questionId !== undefined)
            questionIds.push(r.body.questionId)
    });

    return parsedRequests
}

const requestsParsed = parseRawRequests(submitQuestionsRequests)
function sendRequest(request, questionId, answer) {
    const { method, url, headers, body } = request;
    body.userAnswer = answer;
    body.questionId = questionId;

    return axios({
        method,
        url: `https://${headers.Host}${url}`,
        headers,
        data: body,
    });
}

function sendSubmitRequest(submitRequest) {
    const { method, url, headers, body } = submitRequest;
    return axios({
        method,
        url: `https://${headers.Host}${url}`,
        headers,
        data: body,
    });
}

(async () => {
    console.log('Initializing bomber...');

    for (let i = 0; i < 5; i += 1) {
        await sendRequest(requestsParsed[i], questionIds[i], "a").then();
    }

    const choices = ["a", "a", "a", "a", "a"];
    let maxScore = Number.MIN_SAFE_INTEGER;

    let score = await sendSubmitRequest(requestsParsed[requestsParsed.length - 1]).then(
        (res) => res.data.payload.score
    );

    if (score === 5) {
        console.log(choices);
        return;
    }

    for (let i = 0; i < choices.length; i += 1) {
        const initialChoice = choices[i];
        let c = "a";
        for (let j = 0; j < 4; j += 1) {
            choices[i] = c;
            await sendRequest(requestsParsed[i], questionIds[i], choices[i]);
            const newScore = await sendSubmitRequest(requestsParsed[requestsParsed.length - 1]).then(
                (res) => res.data.payload.score
            );

            maxScore = Math.max(maxScore, newScore);
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(`Current Score: ${maxScore}`);

            if (newScore < score) {
                choices[i] = initialChoice;
                await sendRequest(
                    requestsParsed[i],
                    questionIds[i],
                    choices[i]
                );
                break;
            }

            if (newScore > score) {
                score = newScore;
                break;
            }

            c = String.fromCharCode(c.charCodeAt(0) + 1);
        }
    }

    console.log('\nBombing complete!')
    console.log(`Final answers: [${choices.join(', ')}]`);
})();
