#!/bin/bash

REL_SCRIPT_DIR="`dirname \"$0\"`"
SCRIPT_DIR="`( cd \"$REL_SCRIPT_DIR\" && pwd )`"

test_cli_common()
{
  echo ----------------------------------------
  echo Testing common cli behavior...
  CLI_SCRIPT_NAME=${1:?missing_param}
  CLI_SCRIPT=$SCRIPT_DIR/../../$CLI_SCRIPT_NAME
  echo Script: $CLI_SCRIPT

  # should find the minimal help output
  $CLI_SCRIPT 2>&1 | grep -q "Must define at least one file\." || {
      echo "[$CLI_SCRIPT_NAME] Output should be help message."
      exit 1
  }

  $CLI_SCRIPT 2> /dev/null && {
      echo "[$CLI_SCRIPT_NAME (with no parameters)] Return code should be error."
      exit 1
  }

  $CLI_SCRIPT -invalidParameter 2> /dev/null && {
      echo "[$CLI_SCRIPT_NAME -invalidParameter] Return code should be error."
      exit 1
  }

  $CLI_SCRIPT -h > /dev/null || {
      echo "[$CLI_SCRIPT_NAME -h] Return code should be success."
      exit 1
  }

  $CLI_SCRIPT -v > /dev/null || {
      echo "[$CLI_SCRIPT_NAME -v] Return code should be success."
      exit 1
  }

  MISSING_FILE="$SCRIPT_DIR/../../../js/bin/missing_file"
  MISSING_FILE_MESSAGE="No such file or directory"
  $CLI_SCRIPT $MISSING_FILE 2> /dev/null && {
      echo "[$CLI_SCRIPT_NAME $MISSING_FILE] Return code should be error."
      exit 1
  }

  $CLI_SCRIPT $MISSING_FILE 2>&1 | grep -q "$MISSING_FILE_MESSAGE" || {
      echo "[$CLI_SCRIPT_NAME $MISSING_FILE] Stderr should have useful message."
      exit 1
  }

  if [ "`$CLI_SCRIPT $MISSING_FILE 2> /dev/null`" != "" ]; then
      echo "[$CLI_SCRIPT_NAME $MISSING_FILE] Stdout should have no text."
      exit 1
  fi

}

test_cli_js_beautify()
{
  echo ----------------------------------------
  echo Testing js-beautify cli behavior...
  CLI_SCRIPT=$SCRIPT_DIR/../../js-beautify

  $CLI_SCRIPT $SCRIPT_DIR/../../../js/bin/js-beautify.js > /dev/null || {
      echo "js-beautify output for $SCRIPT_DIR/../bin/js-beautify.js was expected succeed."
      exit 1
  }

  $CLI_SCRIPT $SCRIPT_DIR/../../../js/bin/css-beautify.js > /dev/null || {
      echo "js-beautify output for $SCRIPT_DIR/../bin/css-beautify.js was expected succeed."
      exit 1
  }

  $CLI_SCRIPT $SCRIPT_DIR/../../../js/bin/js-beautify.js | diff $SCRIPT_DIR/../../../js/bin/js-beautify.js - || {
      echo "js-beautify output for $SCRIPT_DIR/../bin/js-beautify.js was expected to be unchanged."
      exit 1
  }

  rm -rf /tmp/js-beautify-mkdir
  $CLI_SCRIPT -o /tmp/js-beautify-mkdir/js-beautify.js $SCRIPT_DIR/../../../js/bin/js-beautify.js && diff $SCRIPT_DIR/../../../js/bin/js-beautify.js /tmp/js-beautify-mkdir/js-beautify.js || {
      echo "js-beautify output for $SCRIPT_DIR/../bin/js-beautify.js should have been created in /tmp/js-beautify-mkdir/js-beautify.js."
      exit 1
  }

  $CLI_SCRIPT $SCRIPT_DIR/../../../js/bin/css-beautify.js | diff -q $SCRIPT_DIR/../../../js/bin/css-beautify.js - && {
      echo "js-beautify output for $SCRIPT_DIR/../bin/css-beautify.js was expected to be different."
      exit 1
  }

}

#test_cli_common css-beautify
#test_cli_common html-beautify
test_cli_common js-beautify

test_cli_js_beautify

echo ----------------------------------------
echo $0 - PASSED.
echo ----------------------------------------
