export type AuthState = {
    auth?: {
        user: {
            id: string;
            email: string;
            fullName: string;
            username: string;
        };
        roles: string[];
        perms: string[]; // ⬅️ new
    };
};