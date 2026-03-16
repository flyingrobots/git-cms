Output "__GIT_CAS_OUTPUT__"

Set Shell "zsh"
Set FontSize 16
Set Width 1200
Set Height 720
Set Padding 16
Set TypingSpeed 36ms
Set Framerate 24

Type 'cd "__GIT_CAS_REPO__"'
Enter
Sleep 600ms

Type 'node bin/git-cas.js inspect --slug demo/hello --cwd "__GIT_CAS_MEDIA_REPO__" | cat'
Enter
Sleep 2s
