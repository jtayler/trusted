# The Age-Restricted Internet

This is a demonstration of inherently safe identity APIs from TruAnon. 

[Visit Demo Site](https://devhauz.truanon.com)

[Watch Demo Video](https://vimeo.com/1049232204)

[View Presentation](https://docs.google.com/presentation/d/1MBaGqDw_L_bgJ3y3c-qqSjzDbDutanBYfkpb75pr2pI/present)

This demonstration highlights three key value propositions:

1. A **Service** is private when the **Owner** decides it should not be displayed. 

2. **Data** is private when a **Publishing Service** decides it shall be governed as such.

3. **Consuming Services** (like this demo) onboard immediately, granting privileged access in response to changes in real-time.

**Owner** updates to privacy and **Service** updates to access take effect immediately.

## API Usage

To use TruAnon APIs, an HTTP GET request must be sent to the desired endpoint. For example, to get a user's verified details, the following get_profile endpoint should be used: `truanon.com/api/get_profile?id=[YOUR_USERNAME]&service=[YOUR_SERVICENAME]`. This single endpoint is the primary way to interact with TruAnon.

The response contains the user's verified details, including their author rank, which can be used to determine the color of their profile badge-of-trust color. The response needs to be parsed and decoded properly to get the necessary data.

To populate data on the profile view page, jQuery can be used to select the desired elements by their ID and change their text or attributes. For example, to change the profile picture's border color, the jQuery `.addClass()` method can be used to add the CSS class returned by the `getPhotoBorderColor()` function to the profile picture's element.

## Route 1: Get User Profile

The first route, defined with `app.get('/users/:username', ...)`, retrieves a user's profile from the TruAnon API if the user's `switch_state` is set to `true`. Here's how the code works:

1. The route extracts the `username` parameter from the request URL and if the user is found, the route checks their `switch_state` property. If it is set to `true`, the route constructs a URL to fetch the user's profile data from the TruAnon API.
2. The route then calls the `truanon.com/api/get_profile?id=[YOUR_USERNAME]&service=[YOUR_SERVICENAME]` endpoint to make a GET request to the TruAnon API using the constructed URL and the `tokenOptions` object that contains the `Authorization` header. It includes the `username` and `service` parameters, as well as the `Authorization` header, which is set to a private key.

## Route 2: Get User Token

The second route, defined with `app.get('/users/:username/token', ...)`, generates a one-time-use expiring token for a user via the TruAnon API. This operation securly connects the user as the one and only profile owner via public hyperlink along with this expiring token and this process happens only once. Here's how the code works:

1. The route extracts the `username` parameter from the request URL.
2. It then constructs a URL to fetch the user's token from the TruAnon API. It includes the `username` and `service` parameters, as well as the `Authorization` header, which is set to a private key.
3. The route then calls the `truanon.com/api/get_token?id=[YOUR_USERNAME]&service=[YOUR_SERVICENAME]` function to make a GET request to the TruAnon API using the constructed public "smart link" URL and associated options object that contains the `Authorization` header.
4. The `fetch` function returns a Promise that resolves to the response object. The route uses the `json` method of the response object to parse the JSON data and obtain the user's expiring token.
5. The route then sends a JSON response with the user's token and this securely assigns ownership of that identity with the requesting service's unique username identifier.

## How to Use the Token to Create a Public Confirmation Link

After fetching the token using the get_token endpoint, you can use it to create a public confirmation link. This link can be displayed as a button or a link on your website or social media profile to allow others to confirm ownership of your account or profile. This token will expire if the user does not use it.

To create the public confirmation link, use the following URL format: `https://staging.truanon.com/api/verifyProfile?id=[YOUR_USERNAME]&service=[YOUR_SERVICENAME]&token=[YOUR_TOKEN]`

The resulting link will open a popup window where the user can securely confirm ownership of your account or profile. This link is a one-time use only and will expire after the user confirms ownership.

To use this link, display it as a button or a link on your website or social media profile. When the user clicks the link, the popup window will open, and they can confirm ownership of your account or profile.

For example, here is how you can create a link with a popup window: `<a href="https://staging.truanon.com/api/verifyProfile?id=[YOUR_USERNAME]&service=[YOUR_SERVICENAME]&token=[YOUR_TOKEN]" target="ta-popup" width="480" height="820" top="327.5" left="397">Confirm Ownership</a>` In this example, the target="ta-popup" attribute will open the link in a popup window with the specified width, height, top, and left values.

Best practice is to offer a privacy "Switch". If this switch is OFF, there is no need to query the API. However, if the privacy switch is turned ON, the user will either be identified as "Unknown" or their profile data can be obtained from the get_profile endpoint. You only need to call for a token if the user is both "Unknown" to TruAnon and is turning ON this switch for the first time. This smart confirmation link must securely assign ownership one time only.

## Conclusion

Get faster onboarding with a convenient way to access confirmed user data for display in any way that is useful. Proper use of JSON parsing and decoding is necessary to ensure the data is used correctly, and the data can be populated on the page through the correct implementation of jQuery

In both routes, the `fetch` function is used to make requests to the TruAnon API. The `Authorization` header is set to a private key, which is passed in via environment variable.
