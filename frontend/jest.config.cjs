module.exports = {
	testEnvironment: 'jsdom',
	setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.js'],
	transform: {
		'^.+\\.[tj]sx?$': 'babel-jest',
	},
	moduleNameMapper: {
		'\\.(css|less|scss|sass)$': 'identity-obj-proxy',
		'\\.(gif|ttf|eot|svg|png|jpg|jpeg|webp)$': '<rootDir>/src/test/fileMock.cjs',
	},
	testPathIgnorePatterns: ['/node_modules/', '/dist/'],
	clearMocks: true,
}
