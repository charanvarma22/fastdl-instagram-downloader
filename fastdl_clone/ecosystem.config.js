module.exports = {
    apps: [
        {
            name: "fastdl-frontend",
            cwd: "./frontend",
            script: "npm",
            args: "start",
            env: {
                PORT: 8081
            }
        },
        {
            name: "fastdl-backend",
            cwd: "./backend/fastdl-backend",
            script: "npm",
            args: "start",
            env: {
                PORT: 3001
            }
        }
    ]
};
