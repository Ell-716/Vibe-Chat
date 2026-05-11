import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { env } from "./env";
import { storage } from "../storage";
import type { User as AppUser } from "@shared/schema";

// Augment Express.User so req.user is typed as our User throughout the app
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends AppUser {}
  }
}

/**
 * Configures the Google OAuth 2.0 passport strategy.
 * On success, finds the user by googleId or creates a new account from
 * the Google profile data. Imports this module for its side effect only.
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID!,
      clientSecret: env.GOOGLE_CLIENT_SECRET!,
      callbackURL: `${env.APP_URL}/auth/google/callback`,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        let user = await storage.getUserByGoogleId(profile.id);

        if (!user) {
          user = await storage.createUser({
            googleId: profile.id,
            email: profile.emails?.[0]?.value ?? "",
            name: profile.displayName,
            avatar: profile.photos?.[0]?.value ?? null,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err as Error);
      }
    }
  )
);

/**
 * Serializes the authenticated user's id into the session.
 * @param user - The authenticated User object.
 * @param done - Passport callback.
 */
passport.serializeUser((user, done) => {
  done(null, (user as AppUser).id);
});

/**
 * Deserializes a user from the session by loading them from storage.
 * @param id - The user id stored in the session.
 * @param done - Passport callback.
 */
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user ?? false);
  } catch (err) {
    done(err);
  }
});

export default passport;
