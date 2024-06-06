const axios = require("axios");
const fs = require("fs");

let questionRawRequest = fs.readFileSync("questionRequest.txt", "utf-8");
let submitRawRequest = fs.readFileSync("submitRequest.txt", "utf-8");
let questionIds = process.argv.slice(2).map((id) => parseInt(id));

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

function sendRequest(rawRequest, answer, questionId) {
    const { method, url, headers, body } = parseRawRequest(rawRequest);
    body.userAnswer = answer;
    body.questionId = questionId;

    return axios({
        method,
        url: `https://${headers.Host}${url}`,
        headers,
        data: body,
    });
}

function sendSubmitRequest(rawRequest) {
    const { method, url, headers, body } = parseRawRequest(rawRequest);

    return axios({
        method,
        url: `https://${headers.Host}${url}`,
        headers,
        data: body,
    });
}

(async () => {
    for (let i = 0; i < 5; i += 1) {
        await sendRequest(questionRawRequest, "a", questionIds[i]).then(
            (res) => {
                console.log(res.data);
            }
        );
    }

    const choices = ["a", "a", "a", "a", "a"];

    let score = await sendSubmitRequest(submitRawRequest).then(
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
            await sendRequest(questionRawRequest, choices[i], questionIds[i]);
            const newScore = await sendSubmitRequest(submitRawRequest).then(
                (res) => res.data.payload.score
            );
            console.log(newScore);

            if (newScore < score) {
                choices[i] = initialChoice;
                await sendRequest(
                    questionRawRequest,
                    choices[i],
                    questionIds[i]
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

    console.log(choices);
})();
