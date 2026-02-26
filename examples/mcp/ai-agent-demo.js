// AI Agent for MCP Server
// This agent can interact with the MCP Server to perform database operations

class AIAgent {
    constructor(mcpBaseUrl, timeout = 30000) {
        this.baseUrl = mcpBaseUrl;
        this.timeout = timeout;
        this.tools = [];
        this.resources = [];
    }

    async init() {
        console.log('Initializing AI Agent...');
        
        try {
            // Discover available tools
            const toolsResponse = await this.fetchWithTimeout('/tools');
            if (!toolsResponse.ok) {
                throw new Error('Failed to fetch tools: ' + toolsResponse.status);
            }
            const toolsData = await toolsResponse.json();
            this.tools = toolsData.tools || [];
            console.log('Available tools:', this.tools.map(t => t.name).join(', '));
            
            // Discover available resources
            const resourcesResponse = await this.fetchWithTimeout('/resources');
            if (!resourcesResponse.ok) {
                throw new Error('Failed to fetch resources: ' + resourcesResponse.status);
            }
            const resourcesData = await resourcesResponse.json();
            this.resources = resourcesData.resources || [];
            console.log('Available resources:', this.resources.map(r => r.uri).join(', '));
        } catch (error) {
            console.error('Initialization failed:', error.message);
            throw error;
        }
    }

    async fetchWithTimeout(path, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const response = await fetch(this.baseUrl + path, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout after ' + this.timeout + 'ms');
            }
            throw error;
        }
    }

    async callTool(toolName, args = {}) {
        try {
            const response = await this.fetchWithTimeout('/mcp', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    method: 'tools/call',
                    params: { name: toolName, arguments: args }
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error('Tool call failed: ' + response.status + ' - ' + (errorData.message || response.statusText));
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error calling tool "' + toolName + '":', error.message);
            throw error;
        }
    }

    async demonstrateCapabilities() {
        console.log('\n=== AI Agent Demo ===\n');
        
        // 1. Get initial stats
        console.log('1. Getting database statistics...');
        const initialStats = await this.callTool('get_stats');
        console.log('   Initial stats:', initialStats);
        
        // 2. List all users
        console.log('\n2. Listing all users...');
        const users = await this.callTool('list_users');
        console.log('   Found', users.users.length, 'users');
        
        // 3. Find a specific user
        if (users.users.length > 0) {
            console.log('\n3. Finding user by email...');
            const firstUser = users.users[0];
            const foundUser = await this.callTool('find_user_by_email', { email: firstUser.email });
            console.log('   Found user:', foundUser.user.name);
        }
        
        // 4. List all posts
        console.log('\n4. Listing all posts...');
        const posts = await this.callTool('list_posts');
        console.log('   Found', posts.posts.length, 'posts');
        
        // 5. Get posts from first user
        if (users.users.length > 0) {
            console.log('\n5. Getting posts from first user...');
            const userPosts = await this.callTool('get_user_posts', { userId: users.users[0].id });
            console.log('   User has', userPosts.posts.length, 'posts');
            if (userPosts.posts.length > 0) {
                console.log('   First post:', userPosts.posts[0].title);
            }
        }
        
        // 6. Search posts
        console.log('\n6. Searching posts...');
        const searchResults = await this.callTool('search_posts', { query: 'hello' });
        console.log('   Found', searchResults.posts.length, 'posts matching "hello"');
        
        // 7. Create new user
        console.log('\n7. Creating new user...');
        const timestamp = Date.now();
        const newUserName = 'AI_Agent_' + timestamp;
        const newUserEmail = 'aiagent_' + timestamp + '@example.com';
        const createdUser = await this.callTool('create_user', {
            name: newUserName,
            email: newUserEmail
        });
        console.log('   Created user:', createdUser.user.name, '(ID:', createdUser.user.id + ')');
        
        // 8. Create post for new user
        console.log('\n8. Creating post for new user...');
        const newPost = await this.callTool('create_post', {
            user_id: createdUser.user.id,
            title: 'Hello from AI Agent',
            content: 'This post was created by an AI agent'
        });
        console.log('   Created post:', newPost.post.title);
        
        // 9. Get updated stats
        console.log('\n9. Getting updated statistics...');
        const finalStats = await this.callTool('get_stats');
        console.log('   Final stats:', finalStats);
        console.log('   Changes:', {
            users: finalStats.users - initialStats.users,
            posts: finalStats.posts - initialStats.posts
        });
        
        // 10. Get the new user's posts
        console.log('\n10. Verifying new user has posts...');
        const newUserPosts = await this.callTool('get_user_posts', { userId: createdUser.user.id });
        console.log('    New user has', newUserPosts.posts.length, 'post(s)');
        
        console.log('\n=== AI Agent Demo Complete ===\n');
        
        return {
            initialStats,
            finalStats,
            createdUser,
            newPost,
            changes: {
                users: finalStats.users - initialStats.users,
                posts: finalStats.posts - initialStats.posts
            }
        };
    }
}

async function main() {
    const mcpServerUrl = 'http://localhost:9000';
    const timeout = 30000;
    
    console.log('Connecting to MCP Server:', mcpServerUrl);
    const agent = new AIAgent(mcpServerUrl, timeout);
    
    try {
        await agent.init();
        const result = await agent.demonstrateCapabilities();
        console.log('Demo completed successfully!');
        console.log('Summary:', result);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main().catch(console.error);