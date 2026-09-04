# ProfileKit Installer

A private, browser-only utility for preparing iOS `.mobileconfig` profiles from
a local file, a direct URL, or pasted XML.

## Live Site

**[Open ProfileKit Installer](https://profilekit-installer.akirale.chatgpt.site)**

The current deployment is owner-only. Sign in with the account that owns the
site to access it. For profile installation on an iPhone or iPad, open the site
in Safari.

## What It Does

ProfileKit turns configuration-profile content into a validated
`.mobileconfig` download using one of three sources:

1. **Device file** — choose or drop an existing `.mobileconfig` file.
2. **Direct URL** — fetch a profile from an HTTP or HTTPS address.
3. **Paste XML** — paste an Apple property-list document and generate the file.

Before download, ProfileKit checks that the content is valid XML, has a
`plist` root, contains the required profile keys, and is no larger than 5 MB.
The generated file uses the `application/x-apple-aspen-config` MIME type
expected by Apple devices.

## Features

- Local XML property-list validation
- File, URL, and pasted XML workflows
- Correct `application/x-apple-aspen-config` download MIME type
- Built-in sample profile for testing
- Clear validation and cross-origin download errors
- Responsive, accessible interface
- No accounts, analytics, or server-side profile storage

## Privacy

Local files and pasted XML stay in the browser. URL-based profiles are fetched
directly by the browser and are not retained by this application. A remote host
must allow cross-origin browser requests for the URL workflow to succeed.

## Development

```bash
npm install
npm run dev
```

Create a production build with `npm run build`.

## License

MIT
