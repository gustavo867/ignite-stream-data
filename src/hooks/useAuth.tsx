import React, {
  useEffect,
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";
import { makeRedirectUri, revokeAsync, startAsync } from "expo-auth-session";
import { generateRandom } from "expo-auth-session/build/PKCE";

import { api } from "../services/api";

interface UserResponse {
  data: {
    id: string;
    login: string;
    display_name: string;
    type: string;
    broadcaster_type: string;
    description: string;
    profile_image_url: string;
    offline_image_url: string;
    view_count: number;
    email: string;
    created_at: Date;
  }[];
}

interface User {
  id: number;
  display_name: string;
  email: string;
  profile_image_url: string;
}

interface AuthContextData {
  user: User;
  isLoggingOut: boolean;
  isLoggingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthProviderData {
  children: ReactNode;
}

const AuthContext = createContext({} as AuthContextData);

const twitchEndpoints = {
  authorization: "https://id.twitch.tv/oauth2/authorize",
  revocation: "https://id.twitch.tv/oauth2/revoke",
};

function AuthProvider({ children }: AuthProviderData) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState({} as User);
  const [userToken, setUserToken] = useState("");

  // get CLIENT_ID from environment variables

  async function signIn() {
    try {
      // set isLoggingIn to true
      setIsLoggingIn(true);

      // REDIRECT_URI - create OAuth redirect URI using makeRedirectUri() with "useProxy" option set to true
      const REDIRECT_URI = makeRedirectUri({ useProxy: true });
      // RESPONSE_TYPE - set to "token"
      const RESPONSE_TYPE = "token";
      // SCOPE - create a space-separated list of the following scopes: "openid", "user:read:email" and "user:read:follows"
      const SCOPE = encodeURI("openid user:read:email user:read:follows");
      // FORCE_VERIFY - set to true
      const FORCE_VERIFY = true;
      // STATE - generate random 30-length string using generateRandom() with "size" set to 30
      const STATE = generateRandom(30);

      // assemble authUrl with twitchEndpoint authorization, client_id,
      // redirect_uri, response_type, scope, force_verify and state
      const authUrl = `${twitchEndpoints.authorization}?client_id=${process.env.CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${SCOPE}&force_verify=${FORCE_VERIFY}&state=${STATE}`;

      console.log("AuthUrl", authUrl);

      // call startAsync with authUrl

      const response = await startAsync({ authUrl });

      if (response.type === "success") {
        if (response.params.error !== "access_denied") {
          if (response.params.state !== STATE) {
            throw new Error("Invalid state value");
          }
        }

        api.defaults.headers.authorization = `Bearer ${response.params.access_token}`;

        const userResponse = await api.get("/users");
        const { data }: UserResponse = userResponse.data;

        setUser({
          display_name: data[0].display_name,
          email: data[0].email,
          id: Number(data[0].id),
          profile_image_url: data[0].profile_image_url,
        });

        setUserToken(response.params.access_token);
      }

      // verify if startAsync response.type equals "success" and response.params.error differs from "access_denied"
      // if true, do the following:

      // verify if startAsync response.params.state differs from STATE
      // if true, do the following:
      // throw an error with message "Invalid state value"

      // add access_token to request's authorization header

      // call Twitch API's users route

      // set user state with response from Twitch API's route "/users"
      // set userToken state with response's access_token from startAsync
    } catch (error) {
      // throw an error
      throw new Error(error);
    } finally {
      setIsLoggingIn(false);
      // set isLoggingIn to false
    }
  }

  async function signOut() {
    try {
      // set isLoggingOut to true
      // call revokeAsync with access_token, client_id and twitchEndpoint revocation
      setIsLoggingOut(true);
      revokeAsync(
        {
          token: userToken,
          clientId: process.env.CLIENT_ID,
        },
        { revocationEndpoint: twitchEndpoints.revocation }
      );
    } catch (error) {
    } finally {
      // set user state to an empty User object
      // set userToken state to an empty string
      // remove "access_token" from request's authorization header
      // set isLoggingOut to false
      setUser({} as User);
      setUserToken("");
      delete api.defaults.headers.authorization;
      setIsLoggingOut(false);
    }
  }

  useEffect(() => {
    api.defaults.headers["Client-Id"] = process.env.CLIENT_ID;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoggingOut, isLoggingIn, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);

  return context;
}

export { AuthProvider, useAuth };
