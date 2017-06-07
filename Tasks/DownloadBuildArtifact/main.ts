import {BuildArtifact, ArtifactResource} from 'vso-node-api/interfaces/BuildInterfaces';
import {WebApi, getBearerHandler} from 'vso-node-api/WebApi';
import * as tl from 'vsts-task-lib/task';

import {ArtifactProvider} from './ArtifactProvider';
import {FileContainerProvider} from './FileContainer';

async function main(): Promise<void> {
	let projectId = tl.getVariable('System.TeamProjectId');
	let buildId = parseInt(tl.getInput("buildId"));
	let artifactName = tl.getInput("artifactName");
	let downloadPath = tl.getPathInput("downloadPath");

	let accessToken = getAuthToken();
	let credentialHandler = getBearerHandler(accessToken);
	let collectionUrl = tl.getVariable("System.TeamFoundationCollectionUri");
	let vssConnection = new WebApi(collectionUrl, credentialHandler);

	// get the artifact metadata
	let buildApi = vssConnection.getBuildApi();
	let artifact = await buildApi.getArtifact(buildId, artifactName, projectId);

	let providers: ArtifactProvider[] = [
		new FileContainerProvider()
	];

	let provider = providers.filter((provider) => provider.supportsArtifactType(artifact.resource.type))[0];
	if (provider) {
		await provider.downloadArtifact(artifact, downloadPath);
	}
	else {
		throw new Error(tl.loc("ArtifactProviderNotFound", artifact.resource.type));
	}
}

function getAuthToken() {
    let auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
    if (auth.scheme.toLowerCase() === 'oauth') {
        return auth.parameters['AccessToken'];
    }
    else {
        throw new Error(tl.loc("CredentialsNotFound"))
    }
}

main()
	.then((result) => tl.setResult(tl.TaskResult.Succeeded, ""))
	.catch((error) => tl.setResult(tl.TaskResult.Failed, error));