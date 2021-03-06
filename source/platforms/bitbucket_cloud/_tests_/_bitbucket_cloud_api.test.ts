import { BitBucketCloudAPI } from "../BitBucketCloudAPI"
import { dangerSignaturePostfix } from "../../../runner/templates/bitbucketCloudTemplate"
import { DangerResults } from "../../../dsl/DangerResults"

const fetchText = (api: any, params: any): Promise<any> => {
  return Promise.resolve({
    ok: true,
    text: () =>
      Promise.resolve(
        JSON.stringify({
          api,
          ...params,
        })
      ),
  })
}

describe("API testing - BitBucket Cloud", () => {
  let api: BitBucketCloudAPI
  let jsonResult: () => any
  let textResult: string
  const expectedJSONHeaders = {
    "Content-Type": "application/json",
    Authorization: `Basic ${new Buffer("username:password").toString("base64")}`,
  }

  function APIFactory(username: string, password: string, uuid: string) {
    const api = new BitBucketCloudAPI(
      { repoSlug: "foo/bar", pullRequestID: "1" },
      {
        username,
        password,
        uuid,
      }
    )

    api.fetch = jest.fn().mockReturnValue({
      status: 200,
      ok: true,
      json: () => jsonResult(),
      text: () => textResult,
    })

    return api
  }

  beforeEach(() => {
    api = APIFactory("username", "password", "{1234-1234-1234-1234}")
  })

  it("getPullRequestsFromBranch", async () => {
    jsonResult = () => ({ isLastPage: true, values: [1] })
    const result = await api.getPullRequestsFromBranch("branch")

    expect(api.fetch).toHaveBeenCalledWith(
      `https://api.bitbucket.org/2.0/repositories/foo/bar/${encodeURI(`pullrequests?q=source.branch.name = "branch"`)}`,
      { method: "GET", body: null, headers: expectedJSONHeaders },
      undefined
    )
    expect(result).toEqual([1])
  })

  it("getPullRequestInfo", async () => {
    jsonResult = () => ({ pr: "info" })
    const result = await api.getPullRequestInfo()

    expect(api.fetch).toHaveBeenCalledWith(
      `https://api.bitbucket.org/2.0/repositories/foo/bar/pullrequests/1`,
      { method: "GET", body: null, headers: expectedJSONHeaders },
      undefined
    )
    expect(result).toEqual({ pr: "info" })
  })

  it("getPullRequestCommits", async () => {
    jsonResult = () => ({ next: undefined, values: ["commit"] })
    const result = await api.getPullRequestCommits()

    expect(api.fetch).toHaveBeenCalledWith(
      `https://api.bitbucket.org/2.0/repositories/foo/bar/pullrequests/1/commits`,
      { method: "GET", body: null, headers: expectedJSONHeaders },
      undefined
    )
    expect(result).toEqual(["commit"])
  })

  it("getPullRequestDiff", async () => {
    api.fetch = fetchText
    let text = await api.getPullRequestDiff()
    expect(JSON.parse(text)).toMatchObject({
      method: "GET",
      api: "https://api.bitbucket.org/2.0/repositories/foo/bar/pullrequests/1/diff",
      headers: expectedJSONHeaders,
    })
  })

  it("getFileContents", async () => {
    api.fetch = fetchText
    let text = await api.getFileContents("Dangerfile.ts", api.repoMetadata.repoSlug, "a0cd")

    expect(JSON.parse(text)).toMatchObject({
      method: "GET",
      api: "https://api.bitbucket.org/2.0/repositories/foo/bar/src/a0cd/Dangerfile.ts",
      headers: expectedJSONHeaders,
    })
  })

  it("getPullRequestComments", async () => {
    jsonResult = () => ({ next: undefined, values: [{ content: { raw: "Hello" } }] })
    const result = await api.getPullRequestComments()

    expect(api.fetch).toHaveBeenCalledWith(
      "https://api.bitbucket.org/2.0/repositories/foo/bar/pullrequests/1/comments?q=deleted=false",
      { method: "GET", body: null, headers: expectedJSONHeaders },
      undefined
    )
    // should filtered out item that doesn't contain comment
    expect(result).toEqual([{ content: { raw: "Hello" } }])
  })

  it("getDangerInlineComments", async () => {
    jsonResult = () => ({
      values: [
        {
          content: {
            raw:
              "\n[//]: # (danger-id-1;)\n[//]: # (  File: dangerfile.ts;\n  Line: 5;)\n\n- :warning: Hello updates\n\n\n  ",
          },
          id: 1234,
          inline: {
            from: 5,
            path: "dangerfile.ts",
          },
          user: {
            uuid: "{1234-1234-1234-1234}",
            display_name: "name",
          },
        },
      ],
    })
    const comments = await api.getDangerInlineComments("1")
    expect(api.fetch).toHaveBeenCalledWith(
      "https://api.bitbucket.org/2.0/repositories/foo/bar/pullrequests/1/comments?q=deleted=false",
      { method: "GET", body: null, headers: expectedJSONHeaders },
      undefined
    )
    expect(comments.length).toEqual(1)
    expect(comments[0].ownedByDanger).toBeTruthy()
  })

  it("getPullRequestActivities", async () => {
    jsonResult = () => ({ isLastPage: true, values: ["activity"] })
    const result = await api.getPullRequestActivities()

    expect(api.fetch).toHaveBeenCalledWith(
      "https://api.bitbucket.org/2.0/repositories/foo/bar/pullrequests/1/activity",
      { method: "GET", body: null, headers: expectedJSONHeaders },
      undefined
    )
    expect(result).toEqual(["activity"])
  })

  it("getDangerComments", async () => {
    const commitID = "e70f3d6468f61a4bef68c9e6eaba9166b096e23c"
    jsonResult = () => ({
      isLastPage: true,
      values: [
        {
          content: {
            raw: `FAIL! danger-id-1; ${dangerSignaturePostfix({} as DangerResults, commitID)}`,
          },
          user: {
            display_name: "name",
            uuid: "{1234-1234-1234-1234}",
          },
        },
        {
          content: {
            raw: "not a danger comment",
          },
          user: {
            display_name: "someone",
            uuid: "{1234-1234-1234-1235}",
          },
        },
      ],
    })
    const result = await api.getDangerComments("1")

    expect(api.fetch).toHaveBeenCalledWith(
      "https://api.bitbucket.org/2.0/repositories/foo/bar/pullrequests/1/comments?q=deleted=false",
      { method: "GET", body: null, headers: expectedJSONHeaders },
      undefined
    )
    expect(result).toEqual([
      {
        content: {
          raw: `FAIL! danger-id-1; ${dangerSignaturePostfix({} as DangerResults, commitID)}`,
        },
        user: {
          uuid: "{1234-1234-1234-1234}",
          display_name: "name",
        },
      },
    ])
  })

  it("postBuildStatus", async () => {
    const payload = {
      state: "SUCCESSFUL" as "SUCCESSFUL",
      key: "key",
      name: "name",
      url: "url",
      description: "description...",
    }
    await api.postBuildStatus("a0cd", payload)

    expect(api.fetch).toHaveBeenCalledWith(
      `https://api.bitbucket.org/2.0/repositories/foo/bar/commit/a0cd/statuses/build`,
      { method: "POST", body: JSON.stringify(payload), headers: expectedJSONHeaders },
      undefined
    )
  })

  it("postPRComment", async () => {
    const comment = "comment..."
    await api.postPRComment(comment)

    expect(api.fetch).toHaveBeenCalledWith(
      `https://api.bitbucket.org/2.0/repositories/foo/bar/pullrequests/1/comments`,
      {
        method: "POST",
        body: JSON.stringify({ content: { raw: comment } }),
        headers: expectedJSONHeaders,
      },
      undefined
    )
  })

  it("deleteComment", async () => {
    await api.deleteComment("1")

    expect(api.fetch).toHaveBeenCalledWith(
      `https://api.bitbucket.org/2.0/repositories/foo/bar/pullrequests/1/comments/1`,
      { method: "DELETE", body: `{}`, headers: expectedJSONHeaders },
      undefined
    )
  })

  it("updateComment", async () => {
    await api.updateComment("1", "Hello!")

    expect(api.fetch).toHaveBeenCalledWith(
      `https://api.bitbucket.org/2.0/repositories/foo/bar/pullrequests/1/comments/1`,
      {
        method: "PUT",
        body: JSON.stringify({ content: { raw: "Hello!" } }),
        headers: expectedJSONHeaders,
      },
      undefined
    )
  })

  it("postInlinePRComment", async () => {
    await api.postInlinePRComment("comment...", 5, "dangerfile.ts")
    expect(api.fetch).toHaveBeenCalledWith(
      `https://api.bitbucket.org/2.0/repositories/foo/bar/pullrequests/1/comments`,
      {
        method: "POST",
        body: JSON.stringify({ content: { raw: "comment..." }, inline: { to: 5, path: "dangerfile.ts" } }),
        headers: expectedJSONHeaders,
      },
      undefined
    )
  })
})
