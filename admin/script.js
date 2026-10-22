const POST_DIRECTORY = "_posts";

let githubToken = null;

const editor = new toastui.Editor({
    el: document.querySelector("#editor"),
    height: "100%",
    initialEditType: "wysiwyg",
    previewStyle: "vertical",
    initialValue: "Start writing your post here...",
    usageStatistics: false,
    hideModeSwitch: true,
    toolbarItems: [
        ["heading", "bold", "italic", "strike"],
        ["hr", "quote"],
        ["ul", "ol", "task"],
        ["table", "link", "image"],
        ["code", "codeblock"]
    ]
});

// SETTINGS

const DEFAULT_REPO = "37jurnalistik/37jurnalistik.github.io";
const DEFAULT_BRANCH = "main";

function loadSettings() {
    const token = localStorage.getItem("github_token");

    if (token) {
        githubToken = token;
        document.getElementById("token").value = token;
    }
}

function saveSettings() {
    const token = document.getElementById("token").value.trim();
    const repo = DEFAULT_REPO;
    const branch = DEFAULT_BRANCH;

    if (token) {
        githubToken = token;
        localStorage.setItem("github_token", token);
    }

    localStorage.setItem("github_repo", repo);
    localStorage.setItem("github_branch", branch);
}

function clearToken() {
    localStorage.removeItem("github_token");
    githubToken = null;
    document.getElementById("token").value = "";
    setStatus("Token removed.");
}

// GITHUB API

async function github(path, options = {}) {
    if (!githubToken) {
        throw new Error("No GitHub token.");
    }

    return fetch(`https://api.github.com${path}`, {
        ...options,
        headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${githubToken}`,
            "X-GitHub-Api-Version": "2022-11-28",
            ...options.headers
        }
    });
}

function repoPath(path = "") {
    return `/repos/${DEFAULT_REPO}${path}`;
}

async function connect() {
    const token = document.getElementById("token").value.trim();

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
            throw new Error(`GitHub returned ${response.status}`);
        }

        const user = await response.json();

        setStatus(`Connected as ${user.login}`);
    } catch (error) {
        console.error(error);
        setStatus(`Connection failed: ${error.message}`);
    }
}

// POST DETAILS

function getValue(id) {
    const element = document.getElementById(id);

    if (!element) {
        throw new Error(`Missing HTML element: #${id}`);
    }

    return element.value.trim();
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
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getPostName() {
    return getValue("post-name");
}

function getFilePath() {
    const name = getPostName();
    const slug = slugify(name);

    if (!slug) {
        return null;
    }

    return `${POST_DIRECTORY}/${getCurrentDate()}-${slug}.md`;
}

function updateFilePath() {
    const filePath = getFilePath();

    document.getElementById("file-path").textContent =
        filePath || `blog/${getCurrentDate()}-post-name.md`;
}

// YAML FRONT MATTER

function yamlString(value) {
    return JSON.stringify(value.trim());
}

function getList(id) {
    return getValue(id)
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);
}

function getFrontMatter() {
    const title = getPostName();
    const author = getValue("author");
    const description = getValue("description");
    const categories = getList("categories");

    const lines = [
        "---",
        `title: ${yamlString(title)}`,
        `author: ${yamlString(author)}`,
        `date: ${getCurrentDate()}`,
        `description: ${yamlString(description)}`,
        `layout: ${yamlString(blog)}`
    ];

    if (categories.length) {
        lines.push("categories:");

        categories.forEach(category => {
            lines.push(`  - ${yamlString(category)}`);
        });
    }

    lines.push("---", "");

    return lines.join("\n");
}

// BASE64 ENCODING

function encodeBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(
            ...bytes.subarray(i, i + chunkSize)
        );
    }

    return btoa(binary);
}

// PUBLISH POST
async function saveFile() {
    if (!githubToken) {
        setStatus("Connect to GitHub first.");
        return;
    }

    if (!getPostName()) {
        setStatus("Enter a post title.");
        return;
    }

    if (!getValue("author")) {
        setStatus("Enter an author.");
        return;
    }

    const filePath = getFilePath();

    if (!filePath) {
        setStatus("Invalid post title.");
        return;
    }

    try {
        setStatus("Publishing...");

        const markdown =
            getFrontMatter() + editor.getMarkdown();

        const body = {
            message: `post: added ${getPostName()}`,
            content: encodeBase64(markdown),
            branch: DEFAULT_BRANCH
        };

        const response = await github(
            repoPath(
                `/contents/${filePath
                    .split("/")
                    .map(encodeURIComponent)
                    .join("/")}`
            ),
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
                result.message || `GitHub returned ${response.status}`
            );
        }

        document.getElementById("current-file").textContent = filePath;

        setStatus(
            `Published successfully: ${result.commit.sha.slice(0, 7)}`
        );
    } catch (error) {
        console.error(error);
        setStatus(`Publish failed: ${error.message}`);
    }
}

function setStatus(message) {
    document.getElementById("status").textContent = message;
}

loadSettings();

if (githubToken) {
    connect();
}
