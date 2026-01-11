# Getting Started with Git CMS

Welcome to **Git CMS**! This tool allows you to write and manage blog posts using Git—the same technology developers use to track code—but with a simple interface that works like a regular app.

Follow these steps to get up and running.

---

## 1. Prerequisites

Before you start, you need two things installed on your computer:

1.  **Git**: [Download and install Git here](https://git-scm.com/downloads). (Choose the default options during installation).
2.  **Node.js**: [Download and install Node.js here](https://nodejs.org/). (Choose the "LTS" version).

---

## 2. Installation

You can install Git CMS directly on your computer or run it using **Docker**.

### Option A: Direct Installation
1.  Open your **Terminal** (on Mac/Linux) or **Command Prompt/PowerShell** (on Windows).
2.  Type the following commands one by one:
    ```bash
    # Download the tool
    git clone https://github.com/clduab11/git-cms.git
    
    # Enter the folder
    cd git-cms
    
    # Install the helper files
    npm install
    
    # Make the 'git-cms' command available everywhere on your computer
    npm link
    ```

### Option B: Using Docker (Recommended for isolation)
If you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed, you can run the CMS without installing Node.js:
1.  Download the tool: `git clone https://github.com/clduab11/git-cms.git`
2.  Enter the folder: `cd git-cms`
3.  Run with Docker: `docker compose up app`
    *Note: By default, this will save posts inside the `git-cms` folder. See Section 3 to change this.*

---

## 3. Setting Up Your "Content Home"

Git CMS doesn't save your posts inside the tool itself; it saves them in a "Repository" (a special folder) of your choice.

1.  Create a new folder for your blog posts (e.g., `my-awesome-blog`).
2.  Enter that folder in your terminal and "initialize" it:
    ```bash
    mkdir my-awesome-blog
    cd my-awesome-blog
    git init
    ```
3.  **Crucial Step**: Tell Git CMS to use this folder. You do this by setting an "Environment Variable" named `GIT_CMS_REPO` to the path of this folder.
    *   **Mac/Linux**: `export GIT_CMS_REPO=/Users/yourname/my-awesome-blog`
    *   **Windows**: `$env:GIT_CMS_REPO="C:\Users\yourname\my-awesome-blog"`

---

## 4. Running the CMS

Now you are ready to start the interface!

1.  In your terminal, type:
    ```bash
    git-cms serve
    ```
2.  You will see a message: `[git-cms] Admin UI: http://localhost:4638/`
3.  Open your web browser (Chrome, Safari, or Edge) and go to **http://localhost:4638/**.

---

## 5. Writing Your First Post

1.  Click the **+ New Article** button on the left.
2.  **Slug**: Enter a short ID for your post (e.g., `my-first-post`). No spaces!
3.  **Title**: Enter the title of your article.
4.  **Content**: Type your post in the large box. You can use [Markdown](https://www.markdownguide.org/basic-syntax/) to add formatting like **bold** or *italics*.
5.  Click **Save Draft**.

### To Make it Public:
When you are happy with your post, click the **Publish** button. This marks the post as "live."

---

## 6. Managing Images and Files

You can add images to your posts easily:
1.  In the editor, click the **Attach File** button at the bottom.
2.  Select an image from your computer.
3.  Git CMS will "chunk" the image, store it safely in Git, and automatically add the code to your post so the image shows up.

---

## 7. Advanced: CLI Power (Optional)

If you prefer using the terminal instead of the web browser, you can use these commands:
*   `git-cms list`: See all your drafts.
*   `git-cms show <slug>`: Read a post in the terminal.
*   `git-cms publish <slug>`: Publish a draft.

---

### Troubleshooting
*   **"Command not found"**: Ensure you ran `npm link` in the `git-cms` folder.
*   **"Not a git repository"**: Ensure you ran `git init` inside your content folder and that your `GIT_CMS_REPO` path is correct.
