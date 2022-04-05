import { IAccount } from "./definitions/Request/Account";
import { UserRole } from "./modules/auth";

declare global {
    namespace Express {
        export interface Request {
            userRole: UserRole;
            _navigation_path: string[];
            account: IAccount
        }
    }
}
