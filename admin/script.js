const POST_DIRECTORY = "blog";

let githubToken = null;

const editor = new EasyMDE({
    element: document.getElementById("editor"),

    spellChecker: false,
    autofocus: false,
    status: false,

    toolbar: [
        "bold",
        "italic",
        "heading",
        "|",
        "quote",
        "unordered-list",
        "ordered-list",
        "|",
        "link",
        "image",
        "code",
        "table",
        "|",
        "preview",
        "side-by-side",
        "fullscreen"
    ]
});


function loadSettings() {
    const token = localStorage.getItem("github_token");
    const repo = localStorage.getItem("github_repo");
    const branch = localStorage.getItem("github_branch");

    if (token) {
        githubToken = token;
        document.getElementById("token").value = token;
    }

    if (repo) {
        document.getElementById("repo").value = repo;
    }

    if (branch) {
        document.getElementById("branch").value = branch;
    }
}


function saveSettings() {
    localStorage.setItem("github_token", githubToken);

    localStorage.setItem(
        "github_repo",
        document.getElementById("repo").value
    );

    localStorage.setItem(
        "github_branch",
        document.getElementById("branch").value
    );
}


function clearToken() {
    localStorage.removeItem("github_token");

    githubToken = null;

    document.getElementById("token").value = "";

    setStatus("Token removed.");
}


async function github(path, options = {}) {
    if (!githubToken) {
        throw new Error("No GitHub token.");
    }

    return fetch(`https://api.github.com${path}`, {
        ...options,

        headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${githubToken}`,
            "X-GitHub-Api-Version": "2026-03-10",

            ...options.headers
        }
    });
}


function repoPath(path = "") {
    const repo = document
        .getElementById("repo")
        .value
        .trim();

    return `/repos/${repo}${path}`;
}


async function connect() {
    const token = document
        .getElementById("token")
        .value
        .trim();

    if (!token) {
        setStatus("Enter a GitHub token.");
        return;
    }

    githubToken = token;

    saveSettings();

    try {
        setStatus("Connecting...");

        const response = await github("/user");

        if (!response.ok) {
            throw new Error(
                `GitHub returned ${response.status}`
            );
        }

        const user = await response.json();

        setStatus(`Connected as ${user.login}`);

    } catch (error) {
        console.error(error);

        setStatus(
            `Connection failed: ${error.message}`
        );
    }
}


function slugify(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}


function getCurrentDate() {
    const now = new Date();

    const year = now.getFullYear();

    const month = String(
        now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        now.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function getPostName() {
    return document
        .getElementById("post-name")
        .value
        .trim();
}


function getFilePath() {
    const name = getPostName();

    if (!name) {
        return null;
    }

    const slug = slugify(name);

    if (!slug) {
        return null;
    }

    const date = getCurrentDate();

    return `${POST_DIRECTORY}/${date}-${slug}.md`;
}


function updateFilePath() {
    const name = getPostName();

    const filePath = getFilePath();

    const pathDisplay =
        document.getElementById("file-path");

    const commitMessage =
        document.getElementById("commit-message");

    if (!name || !filePath) {
        pathDisplay.textContent =
            `blog/${getCurrentDate()}-post-name.md`;

        commitMessage.value = "";

        return;
    }

    pathDisplay.textContent = filePath;

    commitMessage.value = `Add ${name}`;
}


function encodeBase64(text) {
    const bytes = new TextEncoder().encode(text);

    let binary = "";

    const chunkSize = 0x8000;

    for (
        let i = 0;
        i < bytes.length;
        i += chunkSize
    ) {
        binary += String.fromCharCode(
            ...bytes.subarray(i, i + chunkSize)
        );
    }

    return btoa(binary);
}


async function saveFile() {
    if (!githubToken) {
        setStatus("Connect to GitHub first.");
        return;
    }

    const postName = getPostName();

    if (!postName) {
        setStatus("Enter a post name.");
        return;
    }

    const filePath = getFilePath();

    if (!filePath) {
        setStatus("Invalid post name.");
        return;
    }

    const commitMessage =
        document
            .getElementById("commit-message")
            .value
            .trim();

    if (!commitMessage) {
        setStatus("Enter a commit message.");
        return;
    }

    try {
        setStatus("Publishing...");

        const branch =
            document.getElementById("branch").value.trim();

        const body = {
            message: commitMessage,

            content: encodeBase64(
                editor.value()
            ),

            branch
        };

        const response = await github(
            repoPath(`/contents/${filePath}`),
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(body)
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message ||
                `GitHub returned ${response.status}`
            );
        }

        document.getElementById(
            "current-file"
        ).textContent = filePath;

        setStatus(
            `Published successfully: ${result.commit.sha.slice(0, 7)
            }`
        );

    } catch (error) {
        console.error(error);

        setStatus(
            `Publish failed: ${error.message}`
        );
    }
}


function setStatus(message) {
    document.getElementById(
        "status"
    ).textContent = message;
}


loadSettings();

if (githubToken) {
    connect();
}
